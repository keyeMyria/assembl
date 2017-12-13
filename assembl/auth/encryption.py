"""A few symmetric encryption routines"""

import base64
from os import urandom

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import padding, hashes, serialization
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from .make_saml import private_key_from_cleaned_text


class Encryptor(object):
    def encrypt(self, message):
        raise NotImplementedError()


class Decryptor(object):
    def decrypt(self, message):
        raise NotImplementedError()


class AESDecryptor(Decryptor):
    """A decryptor that uses AES symmetric keys"""
    def __init__(self, password, backend=None):
        backend = backend or default_backend()
        self.backend = backend
        self.password = password

    def decrypt(self, message):
        iv = base64.b64decode(message[:24])
        cipher = Cipher(
            algorithms.AES(self.password),
            modes.CBC(iv), backend=self.backend)
        message = base64.b64decode(message[24:])
        decryptor = cipher.decryptor()
        padded = decryptor.update(message)
        padded += decryptor.finalize()
        unpadder = padding.PKCS7(128).unpadder()
        decrypted = unpadder.update(padded)
        decrypted += unpadder.finalize()
        return decrypted


class AESEncryptor(Encryptor):
    """An encryptor that uses AES symmetric keys"""
    def __init__(self, password, backend=None):
        backend = backend or default_backend()
        self.backend = backend
        self.password = password

    def encrypt(self, message):
        iv = urandom(16)
        cipher = Cipher(
            algorithms.AES(self.password),
            modes.CBC(iv), backend=self.backend)
        encryptor = cipher.encryptor()
        padder = padding.PKCS7(128).padder()
        padded = padder.update(message)
        padded += padder.finalize()
        encrypted = encryptor.update(padded)
        encrypted += encryptor.finalize()
        return base64.b64encode(iv) + base64.b64encode(encrypted)


class AESCryptor(AESDecryptor, AESEncryptor):
    pass


class MediactiveAESCryptor(AESCryptor):
    """Mediactive uses the SHA hash of the key as a key"""
    def __init__(self, password):
        backend = default_backend()
        digest = hashes.Hash(hashes.SHA256(), backend=backend)
        digest.update(password)
        password = digest.finalize()
        super(MediactiveAESCryptor, self).__init__(password, backend)
