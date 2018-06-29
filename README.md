# Meetup-events

Simple Firebase function that serves as intent fullfilment handler for dialogflow (Actions on Google).
My action currently has only one welcome intent (`next_meetup`), that announces next upcoming meetup in my meetup.com group.

It aquires events using meetup v2 API, translates texts to English if user locale is not ru-RU using Google Cloud Translation API and caches its response to Firebase Firestore, to avoid abusing Meetup API and Cloud Translation API (which does not have free tier).

It is quite hacky, feel free to add issues.

## Configure and deploy

```
firebase functions:config:set meetup.key=my_key
firebase functions:config:set meetup.group=GDG-Vladivostok
firebase deploy --only functions
```

P.S. My action is available via 'Talk to Vladivostok Software Developers' in English and 'Говорить с Разработчики Владивостока' in Russian.

