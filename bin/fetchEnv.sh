#!/bin/sh
application=$1 
environment=$2 

path="/env/${environment}/${application}" 

echo fetching environment variables from $path

config_data=$(
  aws ssm get-parameter\
    --name ${path}\
    --with-decryption
)

node bin/writeToEnv.ts "$config_data"

