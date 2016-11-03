'use strict';

const aws = require('aws-sdk');
const axios = require('axios');
const dynamo = new aws.DynamoDB.DocumentClient();
const WIT_TOKEN = '';
const WIT_URL = '';

let witrequest = axios.create({
  timeout: 2000,
  headers: {
    'Authorization': 'Bearer ' + WIT_TOKEN,
    'Content-Type': 'application/json'
  },
});

module.exports.schedule = (event, context) => {
  const cb = (err, data) => {
    if (err) {
      console.log(err);
      context.fail('Error creating reminder');
    } else {
      messageBack('Reminder has been stored').then(res => {
        console.log(data);
        context.succeed(data);
      });
    }
  }

  console.log('event: ', event.body);
  let message = event.body.text.replace('rmd ', '');
  let params = {
    q: message
  }
  witrequest.get(WIT_URL, {params}).then(response => {
    console.log(JSON.stringify(response.data.entities, null, 2));
    let datetime = response.data.entities.datetime[0].value;
    let reminder = response.data.entities.reminder[0].value;
    const reminderItem = {
      user_id: event.body.user_id,
      reminder: reminder,
      date: datetime
    }
    const payload = {
      TableName: '435reminder',
      Item: reminderItem
    };
    dynamo.put(payload, cb);
  }).catch(err => {
    console.log('ERR: ', err);
  });
};


module.exports.poll = function(event, context) {
 const payload = {
  TableName: '435reminder'
 }
  const cb = (err, data) => {
    if (err) {
      console.log(err);
      context.fail('Error getting reminders');
    } else {
      //console.log('items: ', JSON.stringify(data, null, 2));
      let toRemind = data.Items.filter(reminderItem => new Date(reminderItem.date) < Date.now());
      let messagePromises = [];
      let deletePromises = [];
      console.log('toremind: ', JSON.stringify(data, null, 2));
      toRemind.forEach(reminderItem => {
        let deleteParams = {
          TableName: '435reminder',
          Key: {
            user_id: reminderItem.user_id,
            date: reminderItem.date
          }
        };
        messagePromises.push(messageBack(reminderItem.reminder + ' is due today'));
        deletePromises.push(dynamo.delete(deleteParams).promise());
      });

      Promise.all(messagePromises, deletePromises).then(res => {
        console.log('deleted');
        context.done(null, data);
      })
    }
  }
  dynamo.scan(payload, cb);
}

module.exports.delete = function(event, context) {
  const payload = {
    TableName: '435reminder',
    Key: {
      petId: event.params.path.petId
    }
  };
  const cb = (err, data) => {
    if (err) {
      console.log(err);
      context.fail('Error retrieving pet');
    } else {
      console.log(data);
      context.done(null, data);
    }
  }
  dynamo.delete(payload, cb);
}

let messageBack = (messageText) => {
  let webhookURL = '';
  var message1 = {
    'text': messageText,
    "username": "TangerineReminders",
    "icon_emoji": ":tangerine:",
    "link_names": 1
  }
  return axios.post(webhookURL, message1);
}
