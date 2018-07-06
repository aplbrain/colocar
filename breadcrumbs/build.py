#!/usr/bin/env python3

import argparse
import configparser
import subprocess

import boto3


# import os


# def upload_files(path):
#     session = boto3.Session(
#         aws_access_key_id='YOUR_AWS_ACCESS_KEY_ID',
#         aws_secret_access_key='YOUR_AWS_SECRET_ACCESS_KEY_ID',
#         region_name='YOUR_AWS_ACCOUNT_REGION'
#     )
#     s3 = session.resource('s3')
#     bucket = s3.Bucket('YOUR_BUCKET_NAME')

#     for subdir, dirs, files in os.walk(path):
#         for file in files:
#             full_path = os.path.join(subdir, file)
#             with open(full_path, 'rb') as data:
#                 bucket.put_object(Key=full_path[len(path) + 1:], Body=data)



def build(zip_path):
    print(subprocess.getoutput("yarn run build"))
    print(subprocess.getoutput(f"zip -r {zip_path} build/*"))

def upload(zip_path, bucket_name, aws_profile):
    session = boto3.Session(region_name="us-east-1", profile_name=aws_profile)
    s3 = session.client("s3")
    bucket = s3.get_bucket(bucket_name)
    print(bucket)

parser = argparse.ArgumentParser(
    description="Command-line interface to build and deploy colocar."
)
parser.add_argument(
    "step",
    help="Argument"
)

args = parser.parse_args()

# Read the config file
config = configparser.ConfigParser()
config.read("build.cfg")

zip_path = config['BUILD'].get('ZipPath', ".")

if args.step == "build":
    build(zip_path)
elif args.step == "build":
    build(zip_path)
