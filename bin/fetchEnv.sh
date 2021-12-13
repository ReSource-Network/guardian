#!/bin/bash

usage() { echo "Usage: $0 
    -e <development|staging|production> 
    -a <client|api|guardian|keystore> 
    [ -o <output_filename_here> ] 
    [ -b ]" # used to grab variables for the build process
    1>&2; exit 1; }

while getopts ":bo:e:a:" o; do
    case "${o}" in
        e)
            environment=${OPTARG}
            e=${OPTARG}
            [ "$e" = "local" ] || [ "$e" = "development" ] || [ "$e" = "staging" ] || [ "$e" = "production" ] || usage
            ;;
        a)
            application=${OPTARG}
            a=${OPTARG}
            [ "$a" = "client" ] || [ "$a" = "keystore" ] || [ "$a" = "guardian" ] || [ "$a" = "api" ] || usage
            ;;
        o)
            output=${OPTARG} || '.env'
            ;;
        b)
            build=1 
            ;;
        *)
            usage
            ;;
    esac
done
shift $((OPTIND-1))

[ $application ] && echo application: $application
[ $environment ] && echo environment: $environment
[ $output ] && echo output-file: $output
[ $build ] && echo build: $build

 
if [ "$build" ]; then path="/env/${environment}/${application}/build" 
else path="/env/${environment}/${application}" 
fi

echo fetching environment variables from $path

config_data=$(
  aws ssm get-parameter\
    --name ${path}\
    --with-decryption
)

echo "$(node bin/parseParams.ts "$config_data")" > ${output:=".env"}

