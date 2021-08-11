import should from 'should';
import { StacksTestnet } from '@stacks/network';
import { register } from '../../../../../src/index';
import { TransactionBuilderFactory, KeyPair } from '../../../../../src/coin/stx';
import * as testData from '../../../../resources/stx/stx';
import { TransactionType } from '../../../../../src/coin/baseCoin';
import { rawPrvToExtendedKeys } from '../../../../../src/utils/crypto';
import { padMemo } from "../../../../../src/coin/stx/utils";

describe('Stx Transfer Builder', () => {
  const factory = register('stx', TransactionBuilderFactory);

  const initTxBuilder = () => {
    const txBuilder = factory.getTransferBuilder();
    txBuilder.fee({ fee: '180' });
    txBuilder.nonce(0);
    txBuilder.to(testData.TX_RECIEVER.address);
    txBuilder.amount('1000');
    return txBuilder;
  };

  describe('should build ', () => {
    it('a signed transfer transaction', async () => {
      const builder = initTxBuilder();
      builder.fromPubKey(testData.TX_SENDER.pub);
      builder.sign({ key: testData.TX_SENDER.prv });
      const tx = await builder.build();

      const txJson = tx.toJson();
      // should.deepEqual(tx.signature.length, 1);
      should.deepEqual(txJson.payload.to, testData.TX_RECIEVER.address);
      should.deepEqual(txJson.payload.amount, '1000');
      should.deepEqual(txJson.from, testData.TX_SENDER.address);
      should.deepEqual(txJson.nonce, 0);
      should.deepEqual(txJson.fee.toString(), '180');
      should.deepEqual(tx.toBroadcastFormat(), testData.SIGNED_TRANSACTION);
      tx.type.should.equal(TransactionType.Send);

      tx.outputs.length.should.equal(1);
      tx.outputs[0].address.should.equal(testData.TX_RECIEVER.address);
      tx.outputs[0].value.should.equal('1000');
      tx.inputs.length.should.equal(1);
      tx.inputs[0].address.should.equal(testData.TX_SENDER.address);
      tx.inputs[0].value.should.equal('1000');
    });

    it('a transfer transaction with memo', async () => {
      const builder = initTxBuilder();
      builder.fromPubKey(testData.TX_SENDER.pub);
      builder.memo('This is an example');
      builder.sign({ key: testData.TX_SENDER.prv });
      const tx = await builder.build();
      const txJson = tx.toJson();
      should.deepEqual(txJson.payload.to, testData.TX_RECIEVER.address);
      should.deepEqual(txJson.payload.amount, '1000');
      should.deepEqual(txJson.payload.memo, 'This is an example');
      should.deepEqual(txJson.from, testData.TX_SENDER.address);
      should.deepEqual(txJson.nonce, 0);
      should.deepEqual(txJson.fee.toString(), '180');
    });

    it('an unsigned multisig signed and verified', async () => {
      const destination = 'STDE7Y8HV3RX8VBM2TZVWJTS7ZA1XB0SSC3NEVH0';
      const amount = '1000';
      const memo = 'test';
      const kp = new KeyPair({ prv: '21d43d2ae0da1d9d04cfcaac7d397a33733881081f0b2cd038062cf0ccbb752601' });
      const kp1 = new KeyPair({ prv: 'c71700b07d520a8c9731e4d0f095aa6efb91e16e25fb27ce2b72e7b698f8127a01' });
      const kp2 = new KeyPair({ prv: 'e75dcb66f84287eaf347955e94fa04337298dbd95aa0dbb985771104ef1913db01' });
      const txBuilder = factory.getTransferBuilder();
      txBuilder.fee({
        fee: '180',
      });
      txBuilder.to(destination);
      txBuilder.amount(amount);
      txBuilder.nonce(1);
      txBuilder.fromPubKey([kp.getKeys().pub, kp1.getKeys().pub, kp2.getKeys().pub]);
      txBuilder.numberSignatures(2);
      txBuilder.memo(memo);
      const tx = await txBuilder.build(); // unsigned multisig tx

      const txBuilder2 = factory.getTransferBuilder();
      txBuilder2.from(tx.toBroadcastFormat());
      txBuilder2.sign({ key: '21d43d2ae0da1d9d04cfcaac7d397a33733881081f0b2cd038062cf0ccbb752601' });
      txBuilder2.sign({ key: 'c71700b07d520a8c9731e4d0f095aa6efb91e16e25fb27ce2b72e7b698f8127a01' });
      txBuilder.fromPubKey([kp.getKeys().pub, kp1.getKeys().pub, kp2.getKeys().pub]);
      const signedTx = await txBuilder2.build(); // signed multisig tx

      const txBuilder3 = factory.getTransferBuilder();
      txBuilder3.from(signedTx.toBroadcastFormat());
      const remake = await txBuilder3.build();
      should.deepEqual(remake.toBroadcastFormat(), signedTx.toBroadcastFormat());
    });

    it('an half signed tx', async () => {
      const destination = 'STDE7Y8HV3RX8VBM2TZVWJTS7ZA1XB0SSC3NEVH0';
      const amount = '1000';
      const memo = 'test';
      const kp = new KeyPair({ prv: '21d43d2ae0da1d9d04cfcaac7d397a33733881081f0b2cd038062cf0ccbb752601' });
      const kp1 = new KeyPair({ prv: 'c71700b07d520a8c9731e4d0f095aa6efb91e16e25fb27ce2b72e7b698f8127a01' });
      const kp2 = new KeyPair({ prv: 'e75dcb66f84287eaf347955e94fa04337298dbd95aa0dbb985771104ef1913db01' });
      const txBuilder = factory.getTransferBuilder();
      txBuilder.fee({
        fee: '180',
      });
      txBuilder.to(destination);
      txBuilder.amount(amount);
      txBuilder.nonce(1);
      txBuilder.sign({ key: '21d43d2ae0da1d9d04cfcaac7d397a33733881081f0b2cd038062cf0ccbb752601' });
      txBuilder.fromPubKey([kp.getKeys(true).pub, kp1.getKeys(true).pub, kp2.getKeys(true).pub]);
      txBuilder.numberSignatures(2);
      txBuilder.memo(memo);
      const tx = await txBuilder.build(); // half signed multisig tx
      should.deepEqual(tx.signature.length, 1);
      const txBuilder2 = factory.getTransferBuilder();
      txBuilder2.from(tx.toBroadcastFormat());
      txBuilder2.sign({ key: 'c71700b07d520a8c9731e4d0f095aa6efb91e16e25fb27ce2b72e7b698f8127a01' });
      txBuilder2.fromPubKey([kp.getKeys(true).pub, kp1.getKeys(true).pub, kp2.getKeys(true).pub]);
      const signedTx = await txBuilder2.build();
      should.deepEqual(
        signedTx.toBroadcastFormat(),
        '808000000004012fe507c09dbb23c3b7e5d166c81fc4b87692510b000000000000000100000000000000b4000000030201091538373641a50a4ebd6f653bb7b477489aceec50eff963072a838d2eaf50e4784c7c6d1490f57b899f0f04c215fce9176d9bb4ce19bfb07499c48878675a1f02008074202e04a7c777b4cdd26ad3fd35194311536113666d81a3840148e59eb43f274d88768ef1202d55633bfdcde8c6057932107354f406af6c378b6ea6b75d1a00038e3c4529395611be9abf6fa3b6987e81d402385e3d605a073f42f407565a4a3d000203020000000000051a1ae3f911d8f1d46d7416bfbe4b593fd41eac19cb00000000000003e874657374000000000000000000000000000000000000000000000000000000000000',
      );
      should.deepEqual(signedTx.signature.length, 2);
    });

    it('an half signed tx with xprv', async () => {
      const destination = 'STDE7Y8HV3RX8VBM2TZVWJTS7ZA1XB0SSC3NEVH0';
      const amount = '1000';
      const memo = 'test';
      const kp = new KeyPair({ prv: '21d43d2ae0da1d9d04cfcaac7d397a33733881081f0b2cd038062cf0ccbb752601' });
      const kp1 = new KeyPair({ prv: 'c71700b07d520a8c9731e4d0f095aa6efb91e16e25fb27ce2b72e7b698f8127a01' });
      const kp2 = new KeyPair({ prv: 'e75dcb66f84287eaf347955e94fa04337298dbd95aa0dbb985771104ef1913db01' });
      const txBuilder = factory.getTransferBuilder();
      txBuilder.fee({
        fee: '180',
      });
      txBuilder.to(destination);
      txBuilder.amount(amount);
      txBuilder.nonce(1);
      txBuilder.sign({ key: '21d43d2ae0da1d9d04cfcaac7d397a33733881081f0b2cd038062cf0ccbb752601' });
      txBuilder.fromPubKey([kp.getKeys(true).pub, kp1.getKeys(true).pub, kp2.getKeys(true).pub]);
      txBuilder.numberSignatures(2);
      txBuilder.memo(memo);
      const tx = await txBuilder.build(); // half signed multisig tx
      should.deepEqual(tx.signature.length, 1);
      const txBuilder2 = factory.getTransferBuilder();
      txBuilder2.from(tx.toBroadcastFormat());
      txBuilder2.fromPubKey([kp.getKeys(true).pub, kp1.getKeys(true).pub, kp2.getKeys(true).pub]);
      const extendedKey = rawPrvToExtendedKeys(kp1.getKeys(false).prv!);
      txBuilder2.sign({ key: extendedKey.xprv });
      const signedTx = await txBuilder2.build();
      should.deepEqual(
        signedTx.toBroadcastFormat(),
        '808000000004012fe507c09dbb23c3b7e5d166c81fc4b87692510b000000000000000100000000000000b4000000030201091538373641a50a4ebd6f653bb7b477489aceec50eff963072a838d2eaf50e4784c7c6d1490f57b899f0f04c215fce9176d9bb4ce19bfb07499c48878675a1f02008074202e04a7c777b4cdd26ad3fd35194311536113666d81a3840148e59eb43f274d88768ef1202d55633bfdcde8c6057932107354f406af6c378b6ea6b75d1a00038e3c4529395611be9abf6fa3b6987e81d402385e3d605a073f42f407565a4a3d000203020000000000051a1ae3f911d8f1d46d7416bfbe4b593fd41eac19cb00000000000003e874657374000000000000000000000000000000000000000000000000000000000000',
      );
      should.deepEqual(signedTx.signature.length, 2);
    });

    it('a multisig transfer transaction', async () => {
      const builder = initTxBuilder();
      builder.network(new StacksTestnet());
      builder.memo('test memo');
      builder.sign({ key: testData.prv1 });
      builder.sign({ key: testData.prv2 });
      builder.fromPubKey([testData.pub1, testData.pub2, testData.pub3]);
      const tx = await builder.build();
      should.deepEqual(tx.toBroadcastFormat(), testData.MULTI_SIG_SIGNED_TRANSACTION);
      should.deepEqual(tx.signature.length, 2);
    });

    it('a multisig serialized transfer transaction', async () => {
      const builder = factory.from(testData.MULTI_SIG_SIGNED_TRANSACTION);
      const tx = await builder.build();
      should.deepEqual(tx.toBroadcastFormat(), testData.MULTI_SIG_SIGNED_TRANSACTION);
    });

    it('a transfer transaction signed multiple times', async () => {
      const builder = initTxBuilder();
      builder.memo('test memo');
      builder.sign({ key: testData.prv1 });
      builder.sign({ key: testData.prv2 });
      builder.fromPubKey([testData.pub1, testData.pub2, testData.pub3]);
      builder.numberSignatures(2);
      const tx = await builder.build();
      const txJson = tx.toJson();
      should.deepEqual(tx.signature.length, 2);
      should.deepEqual(txJson.fee.toString(), '180');
      should.deepEqual(txJson.payload.to, testData.TX_RECIEVER.address);
      should.deepEqual(txJson.payload.memo, 'test memo');
      should.deepEqual(txJson.payload.amount, '1000');
    });

    it('a transfer transaction with amount 0', async () => {
      const builder = initTxBuilder();
      builder.amount('0');
      builder.fromPubKey(testData.TX_SENDER.pub);
      builder.sign({ key: testData.TX_SENDER.prv });
      const tx = await builder.build();
      const txJson = tx.toJson();
      should.deepEqual(txJson.payload.to, testData.TX_RECIEVER.address);
      should.deepEqual(txJson.payload.amount, '0');
      should.deepEqual(txJson.from, testData.TX_SENDER.address);
      should.deepEqual(txJson.fee.toString(), '180');
    });

    it('a transfer transaction signed multiple times with mid key no signer', async () => {
      const builder = initTxBuilder();
      builder.memo('test');
      builder.sign({ key: testData.prv1 });
      builder.fromPubKey([testData.pub1, testData.pub2, testData.pub3]);
      builder.numberSignatures(2);
      const tx = await builder.build();
      const txBuilder2 = factory.getTransferBuilder();
      txBuilder2.from(tx.toBroadcastFormat());
      txBuilder2.sign({ key: testData.prv3 });
      const signedTx = await txBuilder2.build();

      const txJson = signedTx.toJson();
      should.deepEqual(
        signedTx.toBroadcastFormat(),
        '808000000004012fe507c09dbb23c3b7e5d166c81fc4b87692510b000000000000000000000000000000b40000000302009473a37b914f703c81f33141d10eabe4550c4d61f113662cc11cdc0463fc377358408c73d3d3273cdbcc3511dbbd2031b5eaca4cb2b13925da9f9b0c7e64d1a600024abddd63b56c55cd1ed0803c26c473f5f0b9d8473b37b65bd812f035365f154b02016aac0347b8520d8905cbd13c601f45a0ccbbb24831320c54d9ee2c1e3656b76d75e1c527932267d80beb90257bbe2dc7184d9b168993ab3a40fa73be6973c5f5000203020000000000051a1ae3f911d8f1d46d7416bfbe4b593fd41eac19cb00000000000003e874657374000000000000000000000000000000000000000000000000000000000000',
      );

      should.deepEqual(signedTx.signature.length, 2);
      should.deepEqual(txJson.fee.toString(), '180');
      should.deepEqual(txJson.payload.to, testData.TX_RECIEVER.address);
      should.deepEqual(txJson.payload.memo, "test"); //can be fixed with padMemo('test')
      should.deepEqual(txJson.payload.amount, '1000');
    });

    it('get pubkey of a transfer transaction signed', async () => {
      const rawTx =
        '808000000004012fe507c09dbb23c3b7e5d166c81fc4b87692510b000000000000000000000000000000b4000000030002b087ca52f40fdfdf4b16a0bbf7e91e4db2e183ac5c6491a5f60a5450e25de7d00201395ea034f45a3bb09d2a0bcf6f50e7f7f56250b36b1f77c6a3be99318b9aefde5dc25185ed592a8a8bfb6ccfe7f947705f3ac5d54179955bb005b422c3e1ac8b020150b8f5843709be0ab16050fbbbeb8f9566fb74f87cbde647bb7f55243be18f254c0934a1869049458cb7b994a756ef1685921d62cdd227bbc083238e7c6551ed0002030200000000000515927d48fbcc09fa69ed37c862a30295a8e6da39d800000000000003e874657374000000000000000000000000000000000000000000000000000000000000';
      const txBuilder2: any = factory.getTransferBuilder();
      txBuilder2.from(rawTx);
      should.deepEqual(txBuilder2._fromPubKeys, [testData.pub1, testData.pub2, testData.pub3]);
    });

    it('a transfer transaction signed multiple times with first key no signer', async () => {
      const builder = initTxBuilder();
      builder.memo('test');
      builder.sign({ key: testData.prv2 });

      builder.fromPubKey([testData.pub1, testData.pub2, testData.pub3]);
      builder.numberSignatures(2);
      const tx = await builder.build();
      const txBuilder2 = factory.getTransferBuilder();
      txBuilder2.from(tx.toBroadcastFormat());
      txBuilder2.sign({ key: testData.prv3 });
      const signedTx = await txBuilder2.build();

      const txJson = signedTx.toJson();
      should.deepEqual(
        signedTx.toBroadcastFormat(),
        '808000000004012fe507c09dbb23c3b7e5d166c81fc4b87692510b000000000000000000000000000000b4000000030002b087ca52f40fdfdf4b16a0bbf7e91e4db2e183ac5c6491a5f60a5450e25de7d002000436f906d040388e3123eb9c37614d7f39da2f283385cda40997212acfa5b24d032fac8299ae9590fbd24d6398ac1c489b523c418d8c06b35467e685199877860201dba16d040f0af2fa8d4bf388cbc7f0cd7463aa7058c49f7e5db2d72d868d7167528cd8393369b94480f9b7f8a2c9087cbd57d4d1a782e553f9cede66642d12c9000203020000000000051a1ae3f911d8f1d46d7416bfbe4b593fd41eac19cb00000000000003e874657374000000000000000000000000000000000000000000000000000000000000',
      );

      should.deepEqual(signedTx.signature.length, 2);
      should.deepEqual(txJson.fee.toString(), '180');
      should.deepEqual(txJson.payload.to, testData.TX_RECIEVER.address);
      should.deepEqual(txJson.payload.memo, "test"); // can be fixed with padMemo('test')
      should.deepEqual(txJson.payload.amount, '1000');
    });

    describe('serialized transactions', () => {
      it('a non signed transfer transaction from serialized', async () => {
        const builder = factory.from(testData.RAW_TX_UNSIGNED);
        builder.sign({ key: testData.TX_SENDER.prv });
        const tx2 = await builder.build();
        should.deepEqual(tx2.toBroadcastFormat(), testData.SIGNED_TRANSACTION);
        tx2.type.should.equal(TransactionType.Send);
      });

      it('a signed transfer transaction from serialized', async () => {
        const txBuilder = factory.from(testData.SIGNED_TRANSACTION);
        const tx = await txBuilder.build();
        should.deepEqual(tx.toBroadcastFormat(), testData.SIGNED_TRANSACTION);
        tx.type.should.equal(TransactionType.Send);
      });
    });

    describe('should fail', () => {
      it('a transfer transaction with an invalid key', () => {
        const builder = initTxBuilder();
        should.throws(
          () => builder.sign({ key: 'invalidKey' }),
          (e) => e.message === 'Unsupported private key',
        );
      });

      it('a transfer transaction with an invalid destination address', () => {
        const txBuilder = factory.getTransferBuilder();
        should.throws(
          () => txBuilder.to('invalidaddress'),
          (e) => e.message === 'Invalid address',
        );
      });

      it('a transfer transaction with an invalid amount: text value', () => {
        const txBuilder = factory.getTransferBuilder();
        should.throws(
          () => txBuilder.amount('invalidamount'),
          (e) => e.message === 'Invalid amount',
        );
      });

      it('a transfer transaction with an invalid amount: negative value', () => {
        const txBuilder = factory.getTransferBuilder();
        should.throws(
          () => txBuilder.amount('-5'),
          (e) => e.message === 'Invalid amount',
        );
      });

      it('a transfer transaction with an invalid memo', async () => {
        const txBuilder = factory.getTransferBuilder();
        should.throws(
          () => txBuilder.memo('This is a memo that is too long for a transaction'),
          (e) => e.message === 'Memo is too long',
        );
      });
    });
  });
});
