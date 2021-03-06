const should = require('should');
const crypto = require('../../../lib/util/crypto');

describe('util/crypto', () => {
  describe('hashPassword/verifyPassword @slow', () => {
    const { hashPassword, verifyPassword } = crypto;
    // we do not actually verify the hashing itself, as:
    // 1. it is entirely performed by bcrypt, which has is own tests.
    // 2. bcrypt is intentionally slow, and we would like unit tests to be fast.

    it('should always return a Promise', () => {
      hashPassword('').should.be.a.Promise();
      hashPassword('password').should.be.a.Promise();
      verifyPassword('password', 'hashhash').should.be.a.Promise();
    });

    it('should return a Promise of null given a blank plaintext', (done) => {
      hashPassword('').then((result) => {
        should(result).equal(null);
        done();
      });
    });

    it('should not attempt to verify empty plaintext', (done) => {
      verifyPassword('', '$2a$12$hCRUXz/7Hx2iKPLCduvrWugC5Q/j5e3bX9KvaYvaIvg/uvFYEpzSy').then((result) => {
        result.should.equal(false);
        done();
      });
    });

    it('should not attempt to verify empty hash', (done) => {
      verifyPassword('password', '').then((result) => {
        result.should.equal(false);
        done();
      });
    });
  });

  describe('generateToken', () => {
    const { generateToken } = crypto;
    it('should return 48-byte tokens by default', () => {
      generateToken().should.be.a.token();
    });

    it('should accept other lengths', () => {
      // the numbers are not equal due to the base64 conversion.
      generateToken(12).length.should.equal(16);
    });
  });

  describe('generateKeypair', () => {
    const { generateKeypair } = crypto;
    it('should return reasonable values in a Promise @slow', (done) => {
      generateKeypair('test').then((result) => {
        result.pubkey.should.be.a.base64string();
        result.privkey.should.be.a.base64string();
        result.salt.should.be.a.base64string();
        result.iv.should.be.a.base64string();
        done();
      });
    });
  });

  describe('generateLocalCipherer', () => {
    const { generateKeypair, generateLocalCipherer } = crypto;
    it('should return an encipherer with a local key @slow', (done) => {
      generateKeypair('test').then((keys) => {
        const [ localkey, cipherer ] = generateLocalCipherer(keys);
        localkey.should.be.a.base64string();
        cipherer.should.be.a.Function();
        done();
      });
    });

    it('should return an (iv, cipher) tuple when the cipherer is given an iv @slow', (done) => {
      generateKeypair('test').then((keys) => {
        const [ , cipherer ] = generateLocalCipherer(keys);
        const [ iv, cipher ] = cipherer();
        iv.should.be.a.base64string();
        cipher.update.should.be.a.Function();
        cipher.final.should.be.a.Function();
        done();
      });
    });
  });

  describe('getLocalDecipherer', () => {
    const { generateKeypair, generateLocalCipherer, getLocalDecipherer } = crypto;
    it('should successfully round-trip a piece of data @slow', (done) => {
      // init.
      generateKeypair('topsecret').then((initkeys) => {
        // create local cipher; encrypt our plaintext.
        const [ localkey, cipherer ] = generateLocalCipherer(initkeys);
        const [ localiv, cipher ] = cipherer();

        const plain = 'a way a lone a last a loved a long the riverrun,';
        const encrypted = cipher.update(plain, 'utf8', 'base64') + cipher.final('base64');

        // now get a local decipher and decrypt. verify round-trip.
        const keys = { privkey: initkeys.privkey, salt: initkeys.salt, iv: initkeys.iv, local: { key: localkey } };
        getLocalDecipherer(keys, 'topsecret').then((decipherer) => {
          const decipher = decipherer(localiv);
          const unencrypted = decipher.update(encrypted, 'base64', 'utf8') + decipher.final('utf8');

          unencrypted.should.equal(plain);
          done();
        });
      });
    });
  });
});

