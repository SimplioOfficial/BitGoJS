import should from 'should';
import { coins } from '@bitgo/statics';
import { Transaction } from '../../../../src/coin/hbar/transaction';
import * as testData from '../../../resources/hbar/hbar';
import { KeyPair } from '../../../../src/coin/hbar/keyPair';

describe('Hbar Transaction', () => {
  const coin = coins.get('thbar');

  /**
   * @param bytes
   */
  function getTransaction(bytes?: Uint8Array): Transaction {
    return new Transaction(coin, bytes);
  }

  it('should throw empty transaction', () => {
    const tx = getTransaction();
    should.throws(() => {
      tx.toJson();
    });
    should.throws(() => {
      tx.toBroadcastFormat();
    });
  });

  describe('should sign if transaction is', () => {
    it('invalid', function() {
      const tx = getTransaction();
      return tx.sign(testData.INVALID_KEYPAIR_PRV).should.be.rejected();
    });

    it('valid', async () => {
      const tx = getTransaction(testData.WALLET_TXDATA);
      const keypair = new KeyPair({ prv: testData.ACCOUNT_1.prvKeyWithPrefix });
      await tx.sign(keypair).should.be.fulfilled();
      should.equal(
        new Buffer(
          tx.hederaTx
            ._toProto()!
            .getSigmap()!
            .getSigpairList()![0]
            .getPubkeyprefix_asU8()!,
        ).toString('hex'),
        testData.ACCOUNT_1.pubKeyWithPrefix.slice(24),
      );
    });

    it('multiple valid', async () => {
      const tx = getTransaction(testData.WALLET_TXDATA);
      const keypair = new KeyPair({ prv: testData.ACCOUNT_1.prvKeyWithPrefix });
      const keypair2 = new KeyPair({ prv: testData.OPERATOR.privateKey });
      await tx.sign(keypair).should.be.fulfilled();
      should.equal(
        new Buffer(
          tx.hederaTx
            ._toProto()!
            .getSigmap()!
            .getSigpairList()![0]
            .getPubkeyprefix_asU8()!,
        ).toString('hex'),
        testData.ACCOUNT_1.pubKeyWithPrefix.slice(24),
      );
      await tx.sign(keypair2).should.be.fulfilled();
      should.equal(
        new Buffer(
          tx.hederaTx
            ._toProto()!
            .getSigmap()!
            .getSigpairList()![0]
            .getPubkeyprefix_asU8()!,
        ).toString('hex'),
        testData.ACCOUNT_1.pubKeyWithPrefix.slice(24),
      );
      should.equal(
        new Buffer(
          tx.hederaTx
            ._toProto()!
            .getSigmap()!
            .getSigpairList()![1]
            .getPubkeyprefix_asU8()!,
        ).toString('hex'),
        testData.OPERATOR.publicKey.slice(24),
      );
    });
  });

  describe('should return encoded tx', function() {
    it('valid sign', async function() {
      const tx = getTransaction(testData.WALLET_TXDATA);
      await tx.sign(testData.KEYPAIR_PRV);
      should.equal(tx.toBroadcastFormat(), testData.WALLET_SIGNED_TRANSACTION);
    });
  });

  describe('should fail to sign ', () => {
    it('with an invalid key pair ', async () => {
      const tx = getTransaction(testData.WALLET_TXDATA);
      const keypair = new KeyPair({ pub: testData.ACCOUNT_1.pubKeyWithPrefix });
      await tx.sign(keypair).should.be.rejectedWith('Missing private key');
    });
  });
});
