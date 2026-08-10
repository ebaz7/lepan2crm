#!/bin/bash
FILEID=$1
FILENAME=$2
CONFIRM=$(curl -sc /tmp/cookie "https://drive.google.com/uc?export=download&id=${FILEID}" | grep -o 'confirm=[^&]*' | sed 's/confirm=//')
if [ -z "$CONFIRM" ]; then
  curl -L -s -o "${FILENAME}" "https://drive.google.com/uc?export=download&id=${FILEID}"
else
  curl -L -s -b /tmp/cookie "https://drive.google.com/uc?export=download&id=${FILEID}&confirm=${CONFIRM}" -o "${FILENAME}"
fi
