const functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp();
const firestore = admin.firestore();

//meetup.key and meetup.group environment variables
//should be set via firebase functions:config:set
const meetup = require('meetup-api')({key: functions.config().meetup.key});
const meetupGroup = functions.config().meetup.group;

const striptags = require('striptags');

const {
      dialogflow,
      BasicCard,
      Button,
	  Image,
      SimpleResponse
} = require('actions-on-google');
const translate = require('@google-cloud/translate')();

// Instantiate the Dialogflow client.
const app = dialogflow({debug: true});


app.intent('next_meetup', conv => {
    const getCache = (locale) =>
    {
        const eventResult = firestore.doc(`EventCache/${locale}`);
        return eventResult.get()
        .then(ev => {
            console.log(ev.data());
            if (ev.exists && ((new Date) - ev.data().TS) < 60 * 60 * 1000) {
                console.log('Returning value from cache');
                return ev.data();
            }
           return Promise.reject(new Error('Cached value not found'));

        })
        .catch(err => {
            return Promise.reject(err);
        });
    }

    const getEventsPromise = new Promise((resolve, reject) =>
        {
            meetup.getEvents({
                group_urlname: meetupGroup
            }, (error, ev) => {
                if (error) {
                    reject(error);
                }
                resolve(ev);
            });
        });

    const setCache = (locale, Data) => {
        const eventResult = firestore.doc(`EventCache/${locale}`);
        eventResult.set(Data)
            .then(console.log("Stored data"))
            .catch(err => console.log(err));
    }

    return getCache(conv.user.locale)
        .catch(() => {
            return getEventsPromise.then((ev) =>
            {
                if (ev && ev.results.length > 0) {
                    console.log(ev.results);
                    description = striptags(ev.results[0].description, [], '');
                    var date = "";
                    var time = "";
                    if (ev.results[0].time) {
                        date = new Date(ev.results[0].time);
                        //add 10h offset for Vladivostok
                        date.setTime(date.getTime() + 1000 * 60 * 60 * 10);

                        time = `<say-as interpret-as="time">${date.toISOString().slice(11,19)}</say-as>`;
                        date = `<say-as interpret-as="date">${date.toISOString().slice(0,10)}</say-as>`;
                    }
                    name =  ev.results[0].name;
                    venue = (ev.results[0].venue === undefined)? "" : ev.results[0].venue.name;

                    if (conv.user.locale === 'ru-RU') {
                        var Data = {"TS": new Date,
                                    "Text": `<p>${name} пройдёт в ${venue} ${date} в ${time}.</p><p>${description}.</p>`,
									"Name": name,
									"Description": description,
									"URL": ev.results[0].event_url,
									"ImageURL": ev.results[0].photo_url};

                        setCache(conv.user.locale, Data);
                        return Data;
                    }

                    return translate.translate([description, name, venue], {from: 'ru', to: 'en'})
                        .then((results) => {
							description = results[0][0];
							name = results[0][1];
							venue = results[0][2];
                            var Data = {"TS": new Date,
                                        "Text": `<p>${name} will be held in ${venue} ${date} at ${time}.</p><p> ${description}.</p>`,
										"Name": name,
										"Description": description,
										"URL": ev.results[0].event_url,
										"ImageURL": ev.results[0].photo_url};
                            setCache(conv.user.locale, Data);
                            return Data;
                        }).catch(err => {console.log(err)});

                }
                if (conv.user.locale === 'ru-RU')
                    return {"Text": "<p>Пока планов на новые события нет.</p><p>Может вы организуете?</p>"};
                return {"Text": "<p>No planned events.</p><p>Would you like to organize one?</p>"};
            });
        }).then(Data => {
          var ssml = '<speak>'
              + Data.Text
				//makes speech more natural esp. for Russian
                .replace(/, /g,', <break time="200ms"/> ')
                .replace(/\. /g, '. <break time="350ms"/> ')
              + '</speak>';
          if(conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT')
			 && Data.URL && Data.ImageURL) {

			conv.ask((conv.user.locale === 'ru-RU')? 'Ближайшее мероприятие:' : 'Our next event:');
			return conv.close(new BasicCard({
			  text: striptags(Data.Description, [], ''),
			  title: Data.Name,
			  buttons: new Button({
				title: (conv.user.locale === 'ru-RU')? 'Перейти' : 'Go',
				url: Data.URL,
			  }),
			  image: new Image({
				url: Data.ImageURL,
				alt: Data.Name,
			  }),
			}));
          }
          return conv.close(new SimpleResponse({speech:  ssml,
                                                text: striptags(Data.Text, [], '')})
                  );
        });
});

// Set the DialogflowApp object to handle the HTTPS POST request.
exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);

