#!/bin/sh
################################################################################
#  This program and the accompanying materials are
#  made available under the terms of the Eclipse Public License v2.0 which accompanies
#  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
#
#  SPDX-License-Identifier: EPL-2.0
#
#  Copyright Contributors to the Zowe Project.
################################################################################
export _C89_ACCEPTABLE_RC=0
WORKDIR=$(dirname "$0")
TMP="${WORKDIR}/tmp"
mkdir "${TMP}" 2>/dev/null
cd "${TMP}" || exit 8

TARGET="../../../lib/storage.so"
LIBDIR=$(dirname "${TARGET}")
mkdir "${LIBDIR}" 2>/dev/null
rm -f "${TARGET}"

ZSS="../../../../../zss"
COMMON="${ZSS}/deps/zowe-common-c"

if ! c89 \
  -D_XOPEN_SOURCE=600 \
  -DAPF_AUTHORIZED=0 \
  -DNOIBMHTTP \
  "-Wa,goff" "-Wc,langlvl(EXTC99),float(HEX),agg,expo,list(),so(),search(),\
  goff,xref,gonum,roconst,gonum,asm,asmlib('SYS1.MACLIB'),asmlib('CEE.SCEEMAC'),dll" \
   -Wl,dll \
  -I "${ZSS}/h" \
  -I "${COMMON}/h" \
  -o "${TARGET}" \
  ../../c/storage.c \
  ../pluginAPI.x
then
  echo "Build failed"
  RC=8
else
  echo "Build successful"
  extattr +p "${TARGET}"
  RC=0
fi

exit $RC
################################################################################
#  This program and the accompanying materials are
#  made available under the terms of the Eclipse Public License v2.0 which accompanies
#  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
#
#  SPDX-License-Identifier: EPL-2.0
#
#  Copyright Contributors to the Zowe Project.
################################################################################
