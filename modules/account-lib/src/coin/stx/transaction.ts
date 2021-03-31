import {
  BufferReader,
  PayloadType,
  StacksTransaction,
  TransactionSigner,
  createStacksPrivateKey,
  deserializeTransaction,
  addressToString,
  StacksMessageType,
  createStacksPublicKey,
  isSingleSig,
  TransactionAuthField,
} from '@stacks/transactions';
import { BaseCoin as CoinConfig } from '@bitgo/statics';
import { SigningError, ParseTransactionError, InvalidTransactionError } from '../baseCoin/errors';
import { BaseKey } from '../baseCoin/iface';
import { BaseTransaction, TransactionType } from '../baseCoin';
import { SignatureData, TxData } from './iface';
import { getTxSenderAddress, bufferToHexPrefixString, removeHexPrefix } from './utils';
import { KeyPair } from './keyPair';

export class Transaction extends BaseTransaction {
  private _stxTransaction: StacksTransaction;
  protected _type: TransactionType;

  constructor(_coinConfig: Readonly<CoinConfig>) {
    super(_coinConfig);
  }

  /** @inheritdoc */
  canSign(key: BaseKey): boolean {
    return true;
  }

  async sign(keyPair: KeyPair[] | KeyPair): Promise<void> {
    const keyPairs = keyPair instanceof Array ? keyPair : [keyPair];
    const signer = new TransactionSigner(this._stxTransaction);
    for (const kp of keyPairs) {
      const keys = kp.getKeys(kp.getCompressed());
      if (!keys.prv) {
        throw new SigningError('Missing private key');
      }
      const privKey = createStacksPrivateKey(keys.prv);
      signer.signOrigin(privKey);
    }
  }

  async appendOrigin(keyPair: KeyPair): Promise<void> {
    const keys = keyPair.getKeys(keyPair.getCompressed());
    if (!keys.pub) {
      throw new SigningError('Missing public key');
    }
    const pubKey = createStacksPublicKey(keys.pub);
    const signer = new TransactionSigner(this._stxTransaction);
    signer.appendOrigin(pubKey);
  }

  async signWithSignatures(signature: SignatureData): Promise<void> {
    if (!signature) {
      throw new SigningError('Missing signatures');
    }
    this._stxTransaction = this._stxTransaction.createTxWithSignature(signature.data);
  }

  /**
   * Get the signatures associated with this transaction.
   */
  get signature(): string[] {
    if (this._stxTransaction && this._stxTransaction.auth.spendingCondition) {
      if (isSingleSig(this._stxTransaction.auth.spendingCondition)) {
        return [this._stxTransaction.auth.spendingCondition.signature.data];
      } else {
        return this._stxTransaction.auth.spendingCondition.fields.map(this.getSignatureFromField);
      }
    }
    return [];
  }

  private getSignatureFromField(field: TransactionAuthField): string {
    switch (field.contents.type) {
      case StacksMessageType.PublicKey:
        return field.contents.data.toString('hex');
      case StacksMessageType.MessageSignature:
        return field.contents.data;
    }
  }

  /** @inheritdoc */
  toJson() {
    const result: TxData = {
      id: this._stxTransaction.txid(),
      fee: this._stxTransaction.auth.getFee().toString(10),
      from: getTxSenderAddress(this._stxTransaction),
      nonce: this.getNonce(),
      payload: { payloadType: this._stxTransaction.payload.payloadType },
    };

    if (this._stxTransaction.payload.payloadType === PayloadType.TokenTransfer) {
      const payload = this._stxTransaction.payload;
      result.payload.memo = payload.memo.content;
      result.payload.to = addressToString({
        type: StacksMessageType.Address,
        version: payload.recipient.address.version,
        hash160: payload.recipient.address.hash160.toString(),
      });
      result.payload.amount = payload.amount.toString();
    }
    return result;
  }
  toBroadcastFormat(): string {
    return bufferToHexPrefixString(this._stxTransaction.serialize());
  }

  get stxTransaction(): StacksTransaction {
    return this._stxTransaction;
  }

  set stxTransaction(t: StacksTransaction) {
    this._stxTransaction = t;
  }

  private getNonce(): number {
    if (this._stxTransaction.auth.spendingCondition) {
      return this._stxTransaction.auth.spendingCondition.nonce.toNumber();
    } else {
      throw new InvalidTransactionError('spending condition is null');
    }
  }

  /**
   * Sets this transaction payload
   *
   * @param rawTransaction
   */
  fromRawTransaction(rawTransaction: string) {
    const raw = removeHexPrefix(rawTransaction);
    try {
      this._stxTransaction = deserializeTransaction(BufferReader.fromBuffer(Buffer.from(raw, 'hex')));
    } catch (e) {
      throw new ParseTransactionError('Error parsing the raw transaction');
    }
    this.loadInputsAndOutputs();
  }

  /**
   * Set the transaction type
   *
   * @param {TransactionType} transactionType The transaction type to be set
   */
  setTransactionType(transactionType: TransactionType): void {
    this._type = transactionType;
  }

  /**
   * Load the input and output data on this transaction using the transaction json
   * if there are outputs.
   */
  loadInputsAndOutputs(): void {
    const txJson = this.toJson();
    if (txJson.payload.to && txJson.payload.amount) {
      this._outputs = [
        {
          address: txJson.payload.to,
          value: txJson.payload.amount,
          coin: this._coinConfig.name,
        },
      ];

      this._inputs = [
        {
          address: txJson.from,
          value: txJson.payload.amount,
          coin: this._coinConfig.name,
        },
      ];
    }
  }
}
