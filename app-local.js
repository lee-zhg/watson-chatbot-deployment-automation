/**
 *
 * main() will be run when you invoke this action
 *
 * @param Cloud Functions actions accept a single parameter, which must be a JSON object.
 *
 * @return The output of this action, which must be a JSON object.
 *
 */

require("dotenv").config({ silent: true });
let _ = require("lodash");

const AssistantV1 = require("ibm-watson/assistant/v1");
const { IamAuthenticator } = require("ibm-watson/auth");

const fs = require("fs");

async function main(params) {
  // retrieve Assistant conection information from .env or environment variables
  const assistant_version = process.env.ASSISTANT_VERSION;
  const assistant_apikey = process.env.ASSISTANT_APIKEY;
  const assistant_url = process.env.ASSISTANT_URL;
  const assistant_jsonfile = process.env.ASSISTANT_JSONFILE;
  //const skill_id = process.env.SKILL_ID;
  //const skill_name = process.env.SKILL_NAME;

  console.log("=================");
  console.log("assistant_version=" + assistant_version + "\n");
  console.log("assistant_apikey=" + assistant_apikey + "\n");
  console.log("assistant_url=" + assistant_url + "\n");
  console.log("assistant_jsonfile=" + assistant_jsonfile + "\n");

  var data = null;
  var json_data = null;
  var skill_id = "";
  var skills = Array();

  try {
    // read assistant skill jsonfile
    try {
      data = fs.readFileSync(assistant_jsonfile, "utf8");
    } catch (err) {
      console.error(err);
    }

    // convert string to json object
    json_data = JSON.parse(data);
    //console.log(json_data);

    // retrieve skill information
    var skill_name = json_data.name;
    //console.log(skill_name);
    var skill_description = json_data.description;
    //console.log(skill_description);
    var skill_language = json_data.language;
    //console.log(skill_language);
    var skill_learning_opt_out = json_data.learning_opt_out;
    //console.log(skill_learning_opt_out);
    var skill_intents = json_data.intents;
    //console.log(skill_intents);
    var skill_entities = json_data.entities;
    //console.log(skill_entities);
    var skill_metadata = json_data.metadata;
    //console.log(skill_metadata);
    var skill_webhooks = json_data.webhooks;
    //console.log(skill_webhooks);
    var skill_dialog_nodes = json_data.dialog_nodes;
    //console.log(skill_dialog_nodes);
    var skill_counterexamples = json_data.counterexamples;
    //console.log(skill_counterexamples);
    var skill_system_settings = json_data.system_settings;
    //console.log(skill_system_settings);

    // always replace the entire skill
    const skill_append = false;
    const skill_includeAudit = true;

    // authenticate
    const assistant = new AssistantV1({
      version: assistant_version,
      authenticator: new IamAuthenticator({
        apikey: assistant_apikey,
      }),
      serviceUrl: assistant_url,
    });

    // retrieve all skills in the Assistant instance
    await assistant
      .listWorkspaces()
      .then((res) => {
        //skills = JSON.parse(JSON.stringify(res.result, null, 2));
        //skills = res.result.workspaces;
        //skills = JSON.stringify(res.result, null, 2).workspaces;
        skills = _.get(res, "result.workspaces");
        //console.log(skills);
      })
      .catch((err) => {
        console.log(err);
      });

    // identify corresponding skill ID for the skill name if the skill exists
    for (var i = 0; i < skills.length; i++) {
      var skill = skills[i];

      if (skill_name == skill.name) {
        skill_id = skill.workspace_id;
        console.log("Found skill ID: " + skill_id);
      }
    }

	// Update existing skill
    if (skill_id != "") {
      // skill payload
      const params = {
        workspaceId: skill_id,
        version: assistant_version,
        name: skill_name,
        description: "Test workspace modified via API",
        language: skill_language,
        dialogNodes: skill_dialog_nodes,
        counterexamples: skill_counterexamples,
        metadata: skill_metadata,
        learningOptOut: skill_learning_opt_out,
        WorkspaceSystemSettings: skill_system_settings,
        webhooks: skill_webhooks,
        intents: skill_intents,
        entities: skill_entities,
        append: skill_append,
        includeAudit: skill_includeAudit,
      };

      // update the existing skill by replacing the entire skill contents
      await assistant
        .updateWorkspace(params)
        .then((res) => {
          console.log(JSON.stringify(res.result, null, 2));
        })
        .catch((err) => {
          console.log(err);
        });

	// Create a new skill if no existing one is found
    } else {
      // skill payload
      const params = {
        //workspaceId: skill_id,
        version: assistant_version,
        name: skill_name,
        description: "Test workspace modified via API",
        language: skill_language,
        dialogNodes: skill_dialog_nodes,
        counterexamples: skill_counterexamples,
        metadata: skill_metadata,
        learningOptOut: skill_learning_opt_out,
        WorkspaceSystemSettings: skill_system_settings,
        webhooks: skill_webhooks,
        intents: skill_intents,
        entities: skill_entities,
        //append: skill_append,
        includeAudit: skill_includeAudit,
      };

      // create a new skill with the entire contents in the JSON file
	  await assistant.createWorkspace(params)
	  .then(res => {
		console.log(JSON.stringify(res.result, null, 2));
	  })
	  .catch(err => {
		console.log(err)
	  });

    }
  } catch (e) {
    return { error: e };
  }
}

main();
