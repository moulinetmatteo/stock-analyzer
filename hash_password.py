#!/usr/bin/env python3
"""Génère le hash bcrypt d'un mot de passe pour secrets.toml.
Usage : python3 hash_password.py MON_MOT_DE_PASSE
"""
import sys
import bcrypt

if len(sys.argv) < 2:
    print("Usage : python3 hash_password.py MON_MOT_DE_PASSE")
    sys.exit(1)

password = sys.argv[1]
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
print(hashed)
