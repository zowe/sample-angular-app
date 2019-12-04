#!groovy

/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 */


PLUGIN_NAME = "sample-angular-app"
PLUGIN_ID = 'org.zowe.zlux.sample-angular-app'

GITHUB_SSH_KEY = "zlux-jenkins" // This is required for git+ssh npm dependencies


node("zlux-agent") {

  def lib = library("jenkins-library").org.zowe.jenkins_shared_library
  def pipeline = lib.pipelines.generic.GenericPipeline.new(this)
  def baseBranch = env.CHANGE_TARGET? env.CHANGE_TARGET: env.BRANCH_NAME

  pipeline.admins.add("dnikolaev", "sgrady", 'jstruga')

  pipeline.setup(
    packageName: PLUGIN_ID
  )

  pipeline.createStage(
    name: 'Install dependencies',
    stage: {

      sshagent (credentials: [GITHUB_SSH_KEY]) {
        // sh "cd zlux-app-manager/virtual-desktop && npm ci"
        // TypeScript 2.7.2 is not supported; supported versions >=3.2.1
        // Install supported TypeScript version just for the time of analysis
        // sh "cd zlux-app-manager/virtual-desktop && npm update typescript"
        sh \
          """
          packages=\$(find nodeServer webClient -name package.json | { grep -v node_modules || true; })
          for package in \$packages
            do
              sh -c "cd `dirname \$package` && npm ci && npm update typescript"
            done
          """
      }
    }
  )

  pipeline.sonarScan(
    scannerTool     : lib.Constants.DEFAULT_LFJ_SONARCLOUD_SCANNER_TOOL,
    scannerServer   : lib.Constants.DEFAULT_LFJ_SONARCLOUD_SERVER,
    allowBranchScan : lib.Constants.DEFAULT_LFJ_SONARCLOUD_ALLOW_BRANCH,
    failBuild       : false
  )

  pipeline.end()
}
