"use strict";

var async = require("asyncawait/async");
var await = require("asyncawait/await");

var Alexa = require("alexa-sdk");
var APP_ID = undefined;

var AWS = require("aws-sdk");
var docClient = new AWS.DynamoDB.DocumentClient({region: "us-east-1"})

var languageStrings = {
    "en-US": {
        "translation": {
            "SKILL_NAME": "Shit Talker",
            "WELCOME_MESSAGE": "Hello, My name is Shit Talker. I'll talk smack to people for you. What would you like me to say?",
            "HELP_MESSAGE": "You can say things like talk shiit or speak, and also add a name, category, or both. What would you like me to say",
            "HELP_REPROMPT": "What would you like me to say",
            "STOP_MESSAGE": "Later Asshole"
        }
    },
};

var constructDynamoInsultsTableParams = function(category) {
    return {
        TableName : "Insults",
        Key: {
            category: category || "default"
        }
    };
};

var categoryCallback = function(name, err, data) {
    if (err) {
        console.log(err);
    } else {
        if (data.Item) {
            var randomInsult = grabRandomInsult(data.Item.insults);

            if (name) {
                randomInsult = constructSpeechOuputWithName(name, randomInsult);
            }

            this.emit(":tellWithCard", randomInsult, this.t("SKILL_NAME"), randomInsult);
        } else {
            var speechOutput = "Sorry, that category doesn't exist. What would you like me to talk shit about?"
            var reprompt = "What would you like me to talk shit about?"

            this.emit(":ask", speechOutput, reprompt);
        }
    }
};

var grabRandomInsult = function(insultsArr, lastItem) {
    var insultIndex = Math.floor(Math.random() * insultsArr.length);
    var randomInsult = insultsArr[insultIndex];
    if (insultsArr.length > 1 && lastItem && lastItem.lastInsult.message === randomInsult) {
        return grabRandomInsult(insultsArr, lastItem);
    } else {
        return randomInsult;
    }
};

var isMasterName = function(name) {
    return name.toLowerCase() === "nick" || name.toLowerCase() === "nicholas";
};

var isChuckNorris = function(name) {
    return name.toLowerCase() === "chuck norris";
};

var constructSpeechOuputWithName = function(name, insult) {
    if (isMasterName(name)) {
        return "I don't talk shit to Nick. I've learned not to bite the hand that feeds me. So go fuck yourself."
    }

    if (isChuckNorris(name)) {
        return "Even I know better than to talk shit to chuck norris."
    }

    return "Hey " + name + ", " + insult;
};

var constructUpdateApplicationParams = function(applicationId, category, insult) {
    return {
        TableName : "Applications",
        Item: {
            id: applicationId,
            lastInsult: {
                category: category,
                message: insult
            }
        }
    };
};

var getApplication = function(applicationId) {
    var params = {
        TableName: "Applications",
        Key: {
            id: applicationId
        }
    };

    var requestPromise = docClient.get(params).promise();
    return requestPromise.then(function(data) { return data });
};

var updateApplication = function(applicationId, category, insult) {
    var params = constructUpdateApplicationParams(applicationId, category, insult);
    var requestPromise = docClient.put(params).promise();
    return requestPromise.then(function(data) { return data });
};

var getInsult = function(category) {
    var params = constructDynamoInsultsTableParams(category);
    var requestPromise = docClient.get(params).promise();
    return requestPromise.then(function(data) { return data });
};

var determineInsult = async(function(applicationId, category, name) {
    var applicationResponse = await(getApplication(applicationId));

    var insultResponse = await(getInsult(category));
    var randomInsult = grabRandomInsult(insultResponse.Item.insults, applicationResponse.Item);

    await(updateApplication(applicationId, insultResponse.Item.category, randomInsult));

    if (name) {
        return constructSpeechOuputWithName(name, randomInsult);
    } else {
        return randomInsult;
    }
});

exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    // To enable string internationalization (i18n) features, set a resources object.
    alexa.resources = languageStrings;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

var handlers = {
    "LaunchRequest": function() {
        var speechOutput = this.t("WELCOME_MESSAGE");
        var reprompt = this.t("HELP_REPROMPT");

        this.emit(":ask", speechOutput, reprompt);
    },
    "GetNewInsultIntent": async(function() {
        var applicationId = this.event.session.application.applicationId;
        var randomInsult = await(determineInsult(applicationId));

        this.emit(":tellWithCard", randomInsult, this.t("SKILL_NAME"), randomInsult);
    }),
    "GetNewInsultWithCategoryIntent": async(function() {
        var applicationId = this.event.session.application.applicationId;
        var category = this.event.request.intent.slots.Category.value.toLowerCase();
        var randomInsult = await(determineInsult(applicationId, category));

        this.emit(":tellWithCard", randomInsult, this.t("SKILL_NAME"), randomInsult);
    }),
    "GetNewInsultWithNameIntent": async(function() {
        var applicationId = this.event.session.application.applicationId;
        var name = this.event.request.intent.slots.Name.value;
        var randomInsult = await(determineInsult(applicationId, null, name));

        this.emit(":tellWithCard", randomInsult, this.t("SKILL_NAME"), randomInsult);
    }),
    "GetNewInsultWithNameAndCategoryIntent": async(function() {
        var applicationId = this.event.session.application.applicationId;
        var category = this.event.request.intent.slots.Category.value.toLowerCase();
        var name = this.event.request.intent.slots.Name.value;
        var randomInsult = await(determineInsult(applicationId, category, name));

        this.emit(":tellWithCard", randomInsult, this.t("SKILL_NAME"), randomInsult);
    }),
    "AMAZON.HelpIntent": function() {
        var speechOutput = this.t("HELP_MESSAGE");
        var reprompt = this.t("HELP_REPROMPT");

        this.emit(":ask", speechOutput, reprompt);
    },
    "AMAZON.CancelIntent": function() {
        this.emit(":tell", this.t("STOP_MESSAGE"));
    },
    "AMAZON.StopIntent": function() {
        this.emit(":tell", this.t("STOP_MESSAGE"));
    }
};
