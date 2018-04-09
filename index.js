
/**
 * This skill demonstrates a simple skill built with the Amazon Alexa Skills
 * nodejs skill development kit.
 * This skill supports multiple lauguages. (en-US).
 * The Intent Schema, Custom Slots and Sample Utterances for this skill, as well
 * as testing instructions are located at https://github.com/arpit-ag/alexa-skill-cc
 **/

'use strict';
const Alexa = require('alexa-sdk');
const https = require('https');
const AWS = require ("aws-sdk");

//=========================================================================================================================================
//TODO: The items below this comment need your attention.
//=========================================================================================================================================


const APP_ID = 'amzn1.ask.skill.73267993-2fd2-4a94-9fac-783c57176e97';

const SKILL_NAME = 'Customer Care';
const GET_DETAIL_MESSAGE = "Here's the contact details of ";
const HELP_MESSAGE = 'This is customer care skill. I can help you find the contact information of leading brands. You can say give me detail of samsung or any other brand, or, you can say exit...';
const HELP_REPROMPT = 'What can I help you with?';
const STOP_MESSAGE = 'Goodbye!';
const BRAND_NOT_SUPPORTED = 'Sorry, we don\'t have customer care information of ';

//=========================================================================================================================================
// Handlers
//=========================================================================================================================================

const handlers = {
    'NewSession': function() {
        console.log("in NewSession");
        // when you have a new session,
        // this is where you'll
        // optionally initialize
        // after initializing, continue on
        routeToIntent.call(this);
    },
    'LaunchRequest': function () {
        console.log("in LaunchRequest");
        this.response.speak('Welcome to customer care. I can help you find the customer care contact details of popular brands across several categories like telecom operators, mobile brands etc.. Which brand customer care information would you like to know?');
        this.response.listen('May I know which brand customer care information would you like to know?');
        this.emit(':responseReady');
    },
    'AMAZON.HelpIntent': function () {
        const speechOutput = HELP_MESSAGE;
        const reprompt = HELP_REPROMPT;
        let displayoutput = speechOutput;
        let alexa = this;
        storage.getBrands(function(brands){
            if(brands){
                displayoutput += "\n\n Supported Brands : [" + brands + "] \n";
            }
            alexa.response.speak(speechOutput).listen(reprompt);
            alexa.response.cardRenderer(SKILL_NAME, displayoutput);
            alexa.emit(':responseReady');
        });
    },
    'AMAZON.CancelIntent': function () {
        this.response.speak(STOP_MESSAGE);
        this.emit(':responseReady');
    },
    'AMAZON.StopIntent': function () {
        this.response.speak(STOP_MESSAGE);
        this.emit(':responseReady');
    },
    'SessionEndedRequest' : function() {
        console.log('Session ended with reason: ' + this.event.request.reason);
    },
    'CCInfoDetail': function () {
        let isTestingWithSimulator = true; //autofill slots when using simulator, dialog management is only supported with a device
        let filledSlots = delegateSlotCollection.call(this, isTestingWithSimulator);
        let slotValues = getSlotValues(filledSlots);
        
        if(slotValues && slotValues.brand && slotValues.brand.resolved){
            console.log('resolved value = ' + slotValues.brand.resolved);
            var brand = slotValues.brand.resolved;
            let speechOutput = GET_DETAIL_MESSAGE + brand + " customer care";
            let alexa = this;
            let displayoutput = speechOutput;
            storage.getCSInfo(brand,function(csinfo){
                if(csinfo){
                    displayoutput += "\n Contact: " + csinfo.contact;
                    if(csinfo.email != "unavailable")
                        displayoutput += "\n Email: " + csinfo.email;
                    if(csinfo.ophrsstart == csinfo.ophrsend)
                        displayoutput += "\n Operational Hours:  24x7";
                    else
                        displayoutput += "\n Operational Hours: " + csinfo.ophrsstart + ":00 hrs -- " + csinfo.ophrsend + ":00 hrs";
                    speechOutput += '<break time = \'1s\' />' + spellDigitOutput(csinfo.contact);
                }else{
                    speechOutput = BRAND_NOT_SUPPORTED + slotValues.brand.resolved + ' available as of now .';
                    displayoutput = speechOutput;
                }
                alexa.response.cardRenderer(SKILL_NAME, displayoutput);
                alexa.response.speak(speechOutput);
                alexa.emit(':responseReady');
            });
        }
    },
    'Unhandled': function() {
        this.response.speak('Sorry, I didn\'t get that. Try saying something like alexa ask customer care to give me detail of samsung.')
                    .listen('Try saying something like alexa ask customer care to give me detail of samsung.');
        this.emit(':responseReady');
    }
};

const REQUIRED_SLOTS = [
    'brand'
];

//custom error messages for invalid slot types,
const slotsMeta = {
    'brand': {
        'invalid_responses': [
            "I'm sorry, but I'm not qualified to match you with {0}s.",
            "I'm sorry I can't match you with {0}s."
        ],
        'error_default': "I'm sorry I can't match you with {0}s."
    }
}


var storage = (function(){
    var dynamodb = new AWS.DynamoDB.DocumentClient();
    return{
    getCSInfo: function(brandId, callback) {
        var params = {
            TableName: "ccinfo",
            Key: {
                "brandId": brandId
            }
        };
        try{
            dynamodb.get(params,function(err,data){
                console.log('GET Conatct');
                if (err) {
                  return console.error("that didn't work " + err);
                } else {
                if(Object.keys(data).length == 0){
                        // error finding contact doesn't exist
                        callback(false);
                    }else{
                        // found contact
                        console.log(data);
                        callback(data.Item);
                    }
                }
            });
        } catch (error) {
            console.error("Caught" + error);
        }
    },
    getBrands:function(callback){
        var params = {
            TableName: "ccinfo",
            ProjectionExpression: "brandId, contact"
        };
        var result = [];
        try{
            dynamodb.scan(params,function(err, data) {
                if (err) {
                    console.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
                } else {
                    // print all the brands
                    console.log("Scan succeeded.");
                    data.Items.forEach(function(brand) {
                       console.log(brand.brandId + ": ", brand.contact);
                       result.push(brand.brandId);
                    });
            
                    // continue scanning if we have more brands, because
                    // scan can retrieve a maximum of 1MB of data
                    if (typeof data.LastEvaluatedKey != "undefined") {
                        console.log("Scanning for more...");
                        params.ExclusiveStartKey = data.LastEvaluatedKey;
                        dynamodb.scan(params, this);
                    }else{
                        console.log("Scan Finished");
                        callback(result);
                    }
                }
            });
        } catch (error) {
            console.error("Caught" + error);
        }
    },
    };
})();


// ***********************************
// ** Dialog Management
// ***********************************

function spellDigitOutput(number){
    return '<say-as interpret-as="digits"> <prosody rate="x-slow">' + number + ' </prosody> </say-as>';
}

function getSlotValues (filledSlots) {
    //given event.request.intent.slots, a slots values object so you have
    //what synonym the person said - .synonym
    //what that resolved to - .resolved
    //and if it's a word that is in your slot values - .isValidated
    let slotValues = {};

    console.log('The filled slots: ' + JSON.stringify(filledSlots));
    Object.keys(filledSlots).forEach(function(item) {
        //console.log("item in filledSlots: "+JSON.stringify(filledSlots[item]));
        var name = filledSlots[item].name;
        //console.log("name: "+name);
        if(filledSlots[item]&&
           filledSlots[item].resolutions &&
           filledSlots[item].resolutions.resolutionsPerAuthority[0] &&
           filledSlots[item].resolutions.resolutionsPerAuthority[0].status &&
           filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code ) {

            switch (filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code) {
                case "ER_SUCCESS_MATCH":
                    slotValues[name] = {
                        "synonym": filledSlots[item].value,
                        "resolved": filledSlots[item].resolutions.resolutionsPerAuthority[0].values[0].value.name,
                        "isValidated": true
                    };
                    break;
                case "ER_SUCCESS_NO_MATCH":
                    slotValues[name] = {
                        "synonym": filledSlots[item].value,
                        "resolved": filledSlots[item].value,
                        "isValidated":false
                    };
                    break;
                }
            } else {
                slotValues[name] = {
                    "synonym": filledSlots[item].value,
                    "resolved": filledSlots[item].value,
                    "isValidated": false
                };
            }
        },this);
        console.log("slot values: "+JSON.stringify(slotValues));
        return slotValues;
}

// This function delegates multi-turn dialogs to Alexa.
// For more information about dialog directives see the link below.
// https://developer.amazon.com/docs/custom-skills/dialog-interface-reference.html
function delegateSlotCollection(shouldFillSlotsWithTestData) {
    console.log("in delegateSlotCollection");
    console.log("current dialogState: " + this.event.request.dialogState);

    // This will fill any empty slots with canned data provided in defaultData
    // and mark dialogState COMPLETED.
    // USE ONLY FOR TESTING IN THE SIMULATOR.
    // if (shouldFillSlotsWithTestData) {
    //     let filledSlots = fillSlotsWithTestData.call(this, defaultData);
    //     this.event.request.dialogState = "COMPLETED";
    // };

    if (this.event.request.dialogState === "STARTED") {
        console.log("in STARTED");
        console.log(JSON.stringify(this.event));
        var updatedIntent=this.event.request.intent;
        // optionally pre-fill slots: update the intent object with slot values 
        // for which you have defaults, then return Dialog.Delegate with this 
        // updated intent in the updatedIntent property

        if(disambiguateSlot.call(this)){
            console.log("disambiguated: " + JSON.stringify(this.event));
            console.log('delegate');
            return this.emit(":delegate", updatedIntent);
        }
        else{
            console.log("almost completed");
            return this.event.request.intent.slots;
        }
        // console.log('shouldnt see this.');
    } else if (this.event.request.dialogState !== "COMPLETED") {
        console.log("in not completed");
        //console.log(JSON.stringify(this.event));

        if(disambiguateSlot.call(this)){
            console.log('delegate');
            return this.emit(":delegate", updatedIntent);
        }
        else{
            console.log("almost completed");
            return this.event.request.intent.slots;
        }
    } else {
        console.log("in completed");
        //console.log("returning: "+ JSON.stringify(this.event.request.intent));
        // Dialog is now complete and all required slots should be filled,
        // so call your normal intent handler.
        return this.event.request.intent.slots;
    }
}

// If the user said a synonym that maps to more than one value, we need to ask 
// the user for clarification. Disambiguate slot will loop through all slots and
// elicit confirmation for the first slot it sees that resolves to more than 
// one value.
function disambiguateSlot() {
    let currentIntent = this.event.request.intent;
    let requireDelegate = false;
    console.log('disambiguateSlot');
    Object.keys(this.event.request.intent.slots).forEach(function(slotName) {
        let currentSlot = this.event.request.intent.slots[slotName];
        let slotValue = slotHasValue(this.event.request, currentSlot.name);
        if(!slotValue){
            // Users has not provide the slot value
            let slotToElicit = currentSlot.name;
            let prompt = "Okay, What " + currentSlot.name + " are you looking for";
            requireDelegate = true;
            console.log('askslotvalue');
            this.emit(':elicitSlot', slotToElicit, prompt, prompt);
        } else if (currentSlot.confirmationStatus !== 'CONFIRMED' &&
            currentSlot.resolutions &&
            currentSlot.resolutions.resolutionsPerAuthority[0]) {

            if (currentSlot.resolutions.resolutionsPerAuthority[0].status.code == 'ER_SUCCESS_MATCH') {
                console.log('ER_SUCCESS_MATCH');
                // if there's more than one value that means we have a synonym that 
                // mapped to more than one value. So we need to ask the user for 
                // clarification. For example if the user said "mini dog", and 
                // "mini" is a synonym for both "small" and "tiny" then ask "Did you
                // want a small or tiny dog?" to get the user to tell you 
                // specifically what type mini dog (small mini or tiny mini).
                if ( currentSlot.resolutions.resolutionsPerAuthority[0].values.length > 1) {
                    let prompt = 'Which would you like';
                    let size = currentSlot.resolutions.resolutionsPerAuthority[0].values.length;
                    currentSlot.resolutions.resolutionsPerAuthority[0].values.forEach(function(element, index, arr) {
                        prompt += ` ${(index == size -1) ? ' or' : ' '} ${element.value.name}`;
                    });

                    prompt += '?';
                    let reprompt = prompt;
                    // In this case we need to disambiguate the value that they 
                    // provided to us because it resolved to more than one thing so 
                    // we build up our prompts and then emit elicitSlot.
                    requireDelegate = true;
                    this.emit(':elicitSlot', currentSlot.name, prompt, reprompt);
                } else if (currentSlot.confirmationStatus !== 'DENIED') {
                    // Slot value is not confirmed
                    let slotToConfirm = currentSlot.name;
                    let speechOutput = 'You said you want to get customer care information of ' + currentSlot.value + ', right?';
                    let repromptSpeech = speechOutput;
                    requireDelegate = true;
                    console.log('confirmSlot');
                    this.emit(':confirmSlot', slotToConfirm, speechOutput, repromptSpeech);
                    this.emit(":delegate", currentIntent);
                } else {
                    // Users denies the confirmation of slot value
                    let slotToElicit = currentSlot.name;
                    let prompt = "Okay, What " + currentSlot.name + " are you looking for";
                    requireDelegate = true;
                    console.log('askslotvalue');
                    this.emit(':elicitSlot', slotToElicit, prompt, prompt);
                }
            } else if (currentSlot.resolutions.resolutionsPerAuthority[0].status.code == 'ER_SUCCESS_NO_MATCH') {
                // add instrumentation to capture synonyms that we haven't defined.
                console.log("NO MATCH FOR: ", currentSlot.name, " value: ", currentSlot.value);
                this.emit(':tell', BRAND_NOT_SUPPORTED + currentSlot.value + 'Please try some other brand.');
                if (REQUIRED_SLOTS.indexOf(currentSlot.name) > -1) {
                    let prompt = BRAND_NOT_SUPPORTED + currentSlot.value  + ". May I know some other " + currentSlot.name + " name that you are looking for";
                    requireDelegate = true;
                    this.emit(':elicitSlot', currentSlot.name, prompt, prompt);
                }
            }
        }
    }, this);
    return requireDelegate;
}

// Given the request an slot name, slotHasValue returns the slot value if one
// was given for `slotName`. Otherwise returns false.
function slotHasValue(request, slotName) {

    let slot = request.intent.slots[slotName];

    //uncomment if you want to see the request
    //console.log("request = "+JSON.stringify(request)); 
    let slotValue;

    //if we have a slot, get the text and store it into speechOutput
    if (slot && slot.value) {
        //we have a value in the slot
        slotValue = slot.value.toLowerCase();
        return slotValue;
    } else {
        //we didn't get a value in the slot.
        return false;
    }
}

// ***********************************
// ** Helper functions from
// ** These should not need to be edited
// ** www.github.com/alexa/alexa-cookbook
// ***********************************

// ***********************************
// ** Route to Intent
// ***********************************

// after doing the logic in new session,
// route to the proper intent

function routeToIntent() {
    
    switch (this.event.request.type) {
        case 'IntentRequest':
            this.emit(this.event.request.intent.name);
            break;
        case 'LaunchRequest':
            this.emit('LaunchRequest');
            break;
        default:
            this.emit('LaunchRequest');
    }
}

exports.handler = function (event, context, callback) {
    
    // Each time your lambda function is triggered from your skill,
    // the event's JSON will be logged. Check Cloud Watch to see the event.
    // One can copy the log from Cloud Watch and use it for testing.
    console.log("====================");
    console.log("REQUEST: " + JSON.stringify(event));
    console.log("====================");

    let alexa = Alexa.handler(event, context, callback);
    alexa.appId = APP_ID;
    alexa.dynamoDBTableName = 'journalsession'; 
    alexa.registerHandlers(handlers);
    alexa.execute();
};
