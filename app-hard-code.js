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
const IBMCOS = require("ibm-cos-sdk");
const rp = require("request-promise");

// constants and variables holding skill information
var skill_name;
var skill_description;
var skill_language;
var skill_learning_opt_out;
var skill_intents;
var skill_entities;
var skill_metadata;
var skill_webhooks;
var skill_dialog_nodes;
var skill_counterexamples;
var skill_system_settings;

// always replace the entire skill
const skill_append = false;
const skill_includeAudit = true;

// retrieve Assistant conection information from .env or environment variables
//const assistant_version = process.env.ASSISTANT_VERSION;
//const assistant_apikey = process.env.ASSISTANT_APIKEY;
//const assistant_url = process.env.ASSISTANT_URL;

const assistant_version = "2018-05-01";
const assistant_apikey = "<your Assistant instance API key>";
const assistant_url = "your Assistant instance URL";

//const skill_id = process.env.SKILL_ID;
//const skill_name = process.env.SKILL_NAME;

console.log("=================");
console.log("assistant_version=" + assistant_version + "\n");
console.log("assistant_apikey=" + assistant_apikey + "\n");
console.log("assistant_url=" + assistant_url + "\n");

/*
 * establish Assistant connection
 */
const getAssistant = async () => {
  // authenticate
  const assistant = new AssistantV1({
    version: assistant_version,
    authenticator: new IamAuthenticator({
      apikey: assistant_apikey,
    }),
    serviceUrl: assistant_url,
  });

  return assistant;
};

/*
 * get skill ID
 */
const getSkillId = async (assistant) => {
  var skill_id = "";
  var skills = Array();

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

    if (skill.name == skill_name) {
      skill_id = skill.workspace_id;
      console.log("Found skill ID: " + skill_id);
    }
  }

  return skill_id;
};

/*
 * Update existing skill
 */
const updateSkill = async (assistant, skill_id) => {
  console.log("Update existing skill ......\n");

  // skill payload
  const params = {
    workspaceId: skill_id,
    version: assistant_version,
    name: skill_name,
    description: skill_description,
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
};

/*
 * Create new skill
 */
const createSkill = async (assistant) => {
  console.log("Create new skill ......\n");

  // skill payload
  const params = {
    //workspaceId: skill_id,
    version: assistant_version,
    name: skill_name,
    description: skill_description,
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
  await assistant
    .createWorkspace(params)
    .then((res) => {
      console.log(JSON.stringify(res.result, null, 2));
    })
    .catch((err) => {
      console.log(err);
    });
};

/*
 * Connect to IBM Cloud Object Storage
 */
const getS3 = async (endpoint) => {
  //const cos_apikey = process.env.COS_APIKEY;
  //const cos_resource_instance_id = process.env.COS_RESOURCE_INSTANCE_ID;
  const cos_apikey = "<your IBM Cloud Object Storage instance API key>";
  const cos_resource_instance_id = "<your IBM Cloud Object Storage instance ID>";
  let s3Options;

  if (cos_apikey != "") {
    /*
     * Cloud Object Storage S3 can be access via two types of credentials. IAM/HMAC
     * An IAM APIKey can be used to create an S3 Object as below.
     * The APIKey, S3 endpoint and resource Instance Id are required
     */
    s3Options = {
      apiKeyId: cos_apikey,
      serviceInstanceId: cos_resource_instance_id,
      region: "ibm",
      endpoint: new IBMCOS.Endpoint(endpoint),
    };
  } else {
    throw new Error("IAM ApiKey required to create S3 Client");
  }

  console.info(" S3 Options Used: \n", s3Options);
  console.debug("\n\n ================== \n\n");

  return new IBMCOS.S3(s3Options);
};

/*
 * The listBucketsExtended S3 call will return a list of buckets along with the LocationConstraint.
 * This will help in identifing the endpoint that needs to be used for a given bucket.
 */
const listBuckets = async (s3, bucketName) => {
  const params = {
    Prefix: bucketName,
  };
  console.error("\n Fetching extended bucket list to get Location");
  const data = await s3.listBucketsExtended(params).promise();
  console.info(" Response: \n", JSON.stringify(data, null, 2));

  return data;
};

/*
 * get Bucket object for the bucket name
 */
const getBucket = async (s3, bucketName) => {
  const data = await listBuckets(s3, bucketName);

  var buckets = Array();
  var bucket = null;
  buckets = _.get(data, "Buckets");

  if (buckets.length >= 1) {
    bucket = data.Buckets[0];
  }

  console.info(bucket);
  return bucket;
};

/*
 * Cloud Object Storage is available in 3 resiliency across many Availability Zones across the world.
 * Each AZ will require a different endpoint to access the data in it.
 * The endpoints url provides a JSON consisting of all Endpoints for the user.
 */
const getEndpoints = async (endpointsUrl) => {
  console.info("======= Getting Endpoints =========");

  const options = {
    url: endpointsUrl,
    method: "GET",
  };
  const response = await rp(options);
  return JSON.parse(response);
};

/*
 * Once we have the available endpoints, we need to extract the endpoint we need to use.
 * This method uses the bucket's LocationConstraint to determine which endpoint to use.
 */
const findBucketEndpoint = (bucket, endpoints) => {
  const region =
    bucket.region ||
    bucket.LocationConstraint.substring(
      0,
      bucket.LocationConstraint.lastIndexOf("-")
    );
  const serviceEndpoints = endpoints["service-endpoints"];
  const regionUrls =
    serviceEndpoints["cross-region"][region] ||
    serviceEndpoints.regional[region] ||
    serviceEndpoints["single-site"][region];

  if (!regionUrls.public || Object.keys(regionUrls.public).length === 0) {
    return "";
  }
  return Object.values(regionUrls.public)[0];
};

/*
 * Download an Object from COS
 */
const getSkillInfoCOS = async (s3, bucketName, objectName) => {
  const getObjectParam = {
    Bucket: bucketName,
    Key: objectName,
  };
  console.info(" getObject \n", getObjectParam);

  // retrieve the contents of JSON file in COS  
  const data = await s3.getObject(getObjectParam).promise();
  json_data = JSON.parse(data.Body.toString());

  // retrieve skill information
  skill_name = json_data.name;
  //onsole.log(skill_name);
  skill_description = json_data.description;
  //console.log(skill_description);
  skill_language = json_data.language;
  //console.log(skill_language);
  skill_learning_opt_out = json_data.learning_opt_out;
  //console.log(skill_learning_opt_out);
  skill_intents = json_data.intents;
  //console.log(skill_intents);
  skill_entities = json_data.entities;
  //console.log(skill_entities);
  skill_metadata = json_data.metadata;
  //console.log(skill_metadata);
  skill_webhooks = json_data.webhooks;
  //console.log(skill_webhooks);
  skill_dialog_nodes = json_data.dialog_nodes;
  //console.log(skill_dialog_nodes);
  skill_counterexamples = json_data.counterexamples;
  //console.log(skill_counterexamples);
  skill_system_settings = json_data.system_settings;
  //console.log(skill_system_settings);

  return json_data;
};

async function main(params) {
  var skill_id = "";

  try {
    // get assistant skill information from json file stored locally or in IBM Cloud Object Storage
    // get assistant skill information from json file stored in IBM Cloud Object Storage
    // connect to IBM Cloud Object Storage
    const defaultEndpoint = "s3.us.cloud-object-storage.appdomain.cloud";
    var s3 = await getS3(defaultEndpoint);

    /* Fetch the Extended bucket Info for the selected bucket.
     * This call will give us the bucket's Location
     */
    //const cos_bucketName = process.env.COS_BUCKET_NAME;
    const cos_bucketName = "cos-ibm-garage-assistant-operation";
    const bucket = await getBucket(s3, cos_bucketName);

    /* Fetch all the available endpoints in Cloud Object Storage
     * We need to find the correct endpoint to use based on our bucjket's location
     */
    //const cos_endpoints = process.env.COS_ENDPOINTS;
    const cos_endpoints = "https://control.cloud-object-storage.cloud.ibm.com/v2/endpoints";
    const endpoints = await getEndpoints(cos_endpoints);

    /* Find the correct endpoint and set it to the S3 Client
     * We can skip these steps and directly assign the correct endpoint if we know it
     */
    s3.endpoint = await findBucketEndpoint(bucket, endpoints);

    /* Get detail skill information from COS file
     */
    //const cos_objectname = process.env.COS_OBJECTNAME;
    const cos_objectname = "skill-auto-deployment-more.json";
    await getSkillInfoCOS(s3, cos_bucketName, cos_objectname);

    // authenticate and establish Assistant connection
    const assistant = await getAssistant();

    // get skill ID if the skill exists in the Assistant instance
    skill_id = await getSkillId(assistant);

    if (skill_id != "") {
      // Update existing skill
      await updateSkill(assistant, skill_id);
    } else {
      // Create a new skill if no existing one is found
      await createSkill(assistant);
    }
  } catch (e) {
    return { error: e };
  }
}

main();
