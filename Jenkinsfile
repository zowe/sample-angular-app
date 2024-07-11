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
  pipeline.admins.add("dnikolaev", "sgrady")

  def baseBranch = env.CHANGE_TARGET? env.CHANGE_TARGET: env.BRANCH_NAME  
  def zoweManifestURL = \
      "https://raw.githubusercontent.com/zowe/zowe-install-packaging" +
      "/${baseBranch}/manifest.json.template"
  def zoweManifestText = httpRequest(url: zoweManifestURL).content.replace("{BUILD_NUMBER}", "-")

  pipeline.setup(
    packageName: PLUGIN_ID,
    version: readJSON(text: zoweManifestText)["version"],
    github: [
      email : lib.Constants.DEFAULT_GITHUB_ROBOT_EMAIL,
      usernamePasswordCredential: lib.Constants.DEFAULT_GITHUB_ROBOT_CREDENTIAL
    ],
    artifactory: [
      url: lib.Constants.DEFAULT_ARTIFACTORY_URL,
      usernamePasswordCredential : lib.Constants.DEFAULT_ARTIFACTORY_ROBOT_CREDENTIAL
    ],
    pax: [
      sshHost: lib.Constants.DEFAULT_PAX_PACKAGING_SSH_HOST,
      sshPort: lib.Constants.DEFAULT_PAX_PACKAGING_SSH_PORT,
      sshCredential: lib.Constants.DEFAULT_PAX_PACKAGING_SSH_CREDENTIAL,
      remoteWorkspace: lib.Constants.DEFAULT_PAX_PACKAGING_REMOTE_WORKSPACE,
    ],
    skipCheckout: true
  )

  pipeline.createStage(
    name: 'Checkout', 
    stage: {
      dir(PLUGIN_NAME) {
        checkout scm
      }
      pipeline.github.cloneRepository(
          repository: "zowe/zlux-app-manager", branch: baseBranch, folder: "zlux-app-manager"
      )
      pipeline.github.cloneRepository(
          repository: "zowe/zlux-platform", branch: baseBranch, folder: "zlux-platform"
      )
    }
  )

  pipeline.build(
    operation: {
      sshagent (credentials: [GITHUB_SSH_KEY]) {
        sh "cd zlux-app-manager/virtual-desktop && npm ci"
        sh \
          """
          export MVD_DESKTOP_DIR=${env.WORKSPACE}/zlux-app-manager/virtual-desktop
          packages=\$(find ${PLUGIN_NAME} -name package.json | { grep -v node_modules || true; })
          for package in \$packages
            do
              sh -c "cd `dirname \$package` && npm ci && npm run build"
            done
          """
      }
    }
  )

  pipeline.test(
    name: "Unit tests",
    junit : "unit-tests-report.xml",
    allowMissingJunit: true,
    operation: {
      sh \
        """
        packages=\$(find ${PLUGIN_NAME} -name package.json | { grep -v node_modules || true; })
        for package in \$packages
          do
            sh -c "cd `dirname \$package` && npm run test"
          done
        """
    }
  )

  // pipeline.sonarScan(
    // scannerTool: lib.Constants.DEFAULT_SONARQUBE_SCANNER_TOOL,
    // scannerServer: lib.Constants.DEFAULT_SONARQUBE_SERVER
  // )

  // NB: jenkins-shared-library doesn't process `.ext.ext` properly
  pipeline.packaging(
    name: PLUGIN_NAME,
    operation: {
      sh "tar --exclude-from=${PLUGIN_NAME}/.tarignore -zcvf ${PLUGIN_NAME}.tar.gz ${PLUGIN_NAME}"
      sh "mkdir -p .pax/ascii && tar -C .pax/ascii -xf ${PLUGIN_NAME}.tar.gz" 
      pipeline.pax.pack(
        job             : "pax-packaging-${PLUGIN_NAME}",
        filename        : "${PLUGIN_NAME}.pax.Z",
        paxOptions      : '',
        keepTempFolder  : false,
        compress        : true
      )
    }
  )
  
  pipeline.publish(
    artifacts: ["${PLUGIN_NAME}.tar.gz", ".pax/${PLUGIN_NAME}.pax.Z"]
  )

  pipeline.end()
}
