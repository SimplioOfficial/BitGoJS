/**
 * @prettier
 */
import { CoinFamily, BaseCoin as StaticsBaseCoin } from '@bitgo/statics';
import { getBuilder, Eth } from '@bitgo/account-lib';
import * as Bluebird from 'bluebird';
import * as bitcoinMessage from 'bitcoinjs-message';
import * as bitgoUtxoLib from 'bitgo-utxo-lib';
import * as crypto from 'crypto';

import {
  BaseCoin,
  KeyPair,
  ParsedTransaction,
  ParseTransactionOptions,
  SignedTransaction,
  SignTransactionOptions,
  VerifyAddressOptions,
  VerifyTransactionOptions,
  TransactionFee,
  TransactionRecipient as Recipient,
  TransactionPrebuild as BaseTransactionPrebuild,
  TransactionExplanation,
} from '../baseCoin';

import { BitGo } from '../../bitgo';
import { NodeCallback } from '../types';
import { InvalidAddressError, MethodNotImplementedError } from '../../errors';
import BigNumber from 'bignumber.js';

export interface EthSignTransactionOptions extends SignTransactionOptions {
  txPrebuild: TransactionPrebuild;
  prv: string;
}

export interface TxInfo {
  recipients: Recipient[];
  from: string;
  txid: string;
}

export interface TransactionPrebuild extends BaseTransactionPrebuild {
  txHex: string;
  txInfo: TxInfo;
  feeInfo: EthTransactionFee;
  source: string;
  dataToSign: string;
}

export interface EthTransactionFee {
  fee: string;
  gasLimit?: string;
}

export interface ExplainTransactionOptions {
  txHex?: string;
  halfSigned?: {
    txHex: string;
  };
  feeInfo: TransactionFee;
}

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export abstract class AbstractEthLikeCoin extends BaseCoin {
  protected readonly _staticsCoin: Readonly<StaticsBaseCoin>;

  protected constructor(bitgo: BitGo, staticsCoin?: Readonly<StaticsBaseCoin>) {
    super(bitgo);

    if (!staticsCoin) {
      throw new Error('missing required constructor parameter staticsCoin');
    }

    this._staticsCoin = staticsCoin;
  }

  getChain() {
    return this._staticsCoin.name;
  }

  getFamily(): CoinFamily {
    return this._staticsCoin.family;
  }

  getFullName() {
    return this._staticsCoin.fullName;
  }

  getBaseFactor() {
    return Math.pow(10, this._staticsCoin.decimalPlaces);
  }

  valuelessTransferAllowed(): boolean {
    return true;
  }

  isValidAddress(address: string): boolean {
    if (!address) {
      return false;
    }
    return Eth.Utils.isValidEthAddress(address);
  }

  generateKeyPair(seed?: Buffer): KeyPair {
    if (!seed) {
      seed = crypto.randomBytes(512 / 8);
    }
    const extendedKey = bitgoUtxoLib.HDNode.fromSeedBuffer(seed);
    const xpub = extendedKey.neutered().toBase58();

    return {
      pub: xpub,
      prv: extendedKey.toBase58(),
    };
  }

  parseTransaction(
    params: ParseTransactionOptions,
    callback?: NodeCallback<ParsedTransaction>
  ): Bluebird<ParsedTransaction> {
    return Bluebird.resolve({}).asCallback(callback);
  }

  verifyAddress({ address }: VerifyAddressOptions): boolean {
    if (!this.isValidAddress(address)) {
      throw new InvalidAddressError(`invalid address: ${address}`);
    }
    return true;
  }

  verifyTransaction(params: VerifyTransactionOptions, callback?: NodeCallback<boolean>): Bluebird<boolean> {
    return Bluebird.resolve(true).asCallback(callback);
  }

  async signTransaction(
    params: EthSignTransactionOptions,
    callback?: NodeCallback<SignedTransaction>
  ): Bluebird<SignedTransaction> {
    const txBuilder = this.getTransactionBuilder();
    txBuilder.from(params.txPrebuild.txHex);
    txBuilder.transfer().key(new Eth.KeyPair({ prv: params.prv }).getKeys().prv!);
    const transaction = await txBuilder.build();

    return {
      halfSigned: {
        txHex: transaction.toBroadcastFormat(),
      },
    };
  }

  async signMessage(key: { prv: string }, message: string | Buffer, callback?: NodeCallback<Buffer>): Bluebird<Buffer> {
    const privateKey = bitgoUtxoLib.HDNode.fromBase58(key.prv).getKey();
    const privateKeyBuffer = privateKey.d.toBuffer(32);
    const isCompressed = privateKey.compressed;
    const prefix = bitgoUtxoLib.networks.bitcoin.messagePrefix;
    return bitcoinMessage.sign(message, privateKeyBuffer, isCompressed, prefix);
  }

  isValidPub(pub: string): boolean {
    let valid = true;
    try {
      new Eth.KeyPair({ pub });
    } catch (e) {
      valid = false;
    }
    return valid;
  }

  /**
   * Builds a funds recovery transaction without BitGo.
   * We need to do three queries during this:
   * 1) Node query - how much money is in the account
   * 2) Build transaction - build our transaction for the amount
   * 3) Send signed build - send our signed build to a public node
   * @param params The options with which to recover
   * @param callback Callback for the result of this operation
   */
  recover(params: any, callback?: NodeCallback<any>): Bluebird<any> {
    throw new MethodNotImplementedError();
  }

  /**
   * Explain a transaction from txHex
   * @param params The options with which to explain the transaction
   * @param callback Callback for the result of this operation
   */
  async explainTransaction(
    params: ExplainTransactionOptions,
    callback?: NodeCallback<TransactionExplanation>
  ): Bluebird<TransactionExplanation> {
    const txHex = params.txHex || (params.halfSigned && params.halfSigned.txHex);
    if (!txHex || !params.feeInfo) {
      throw new Error('missing explain tx parameters');
    }
    const txBuilder = this.getTransactionBuilder();
    txBuilder.from(txHex);
    const tx = await txBuilder.build();
    const outputs = tx.outputs.map(output => {
      return {
        address: output.address,
        amount: output.value,
      };
    });

    const displayOrder = ['id', 'outputAmount', 'changeAmount', 'outputs', 'changeOutputs', 'fee'];

    return {
      displayOrder,
      id: tx.id,
      outputs: outputs,
      outputAmount: outputs
        .reduce((accumulator, output) => accumulator.plus(output.amount), new BigNumber('0'))
        .toFixed(0),
      changeOutputs: [], // account based does not use change outputs
      changeAmount: '0', // account base does not make change
      fee: params.feeInfo,
    };
  }

  /**
   * Create a new transaction builder for the current chain
   * @return a new transaction builder
   */
  private getTransactionBuilder(): Eth.TransactionBuilder {
    const txBuilder: Eth.TransactionBuilder = getBuilder(this.getChain()) as Eth.TransactionBuilder;

    // @bitgo/account-lib requires something to be set here,
    // though it doesn't do anything except when signing the external transaction
    // TODO: Remove when bug in account lib requiring this field is fixed
    txBuilder.source(NULL_ADDRESS);

    return txBuilder;
  }
}
