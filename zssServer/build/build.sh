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
TARGET=../../lib/storage.so
ZSS=~/zowe/zss
ZOWECOMMON="${ZSS}/deps/zowe-common-c"
LIBDIR=$(dirname "${TARGET}")

mkdir tmp 2>/dev/null
mkdir "$LIBDIR" 2>/dev/null


(
  cd tmp && \
  c89 -D_XOPEN_SOURCE=600 -DAPF_AUTHORIZED=0 -DNOIBMHTTP \
  "-Wa,goff" "-Wc,langlvl(EXTC99),float(HEX),agg,expo,list(),so(),search(),\
  goff,xref,gonum,roconst,gonum,asm,asmlib('SYS1.MACLIB'),asmlib('CEE.SCEEMAC'),dll" -Wl,dll \
  -I "${ZSS}/h" \
  -I "${ZOWECOMMON}/h" \
  -I../../h \
  -o "../${TARGET}" \
  ../../c/storage.c \
  ../pluginAPI.x \
)
rm -rf tmp 2>/dev/null

extattr +p "${TARGET}"

# Remove lines below
cp -v "${TARGET}" ~/zowe/zlux/lib/storage.so
extattr +p ~/zowe/zlux/lib/storage.so

################################################################################
#  This program and the accompanying materials are
#  made available under the terms of the Eclipse Public License v2.0 which accompanies
#  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
#
#  SPDX-License-Identifier: EPL-2.0
#
#  Copyright Contributors to the Zowe Project.
################################################################################
