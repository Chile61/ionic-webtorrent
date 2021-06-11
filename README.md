
# SeedWallet Android App


## Using this project

This versions must be used:

Cordova
10.0.0

Ionic
5.4.16

NodeJS
10.15.3

Android SDK Tools
29

Python
2.7.0

Java SE Development Kit 8 (JDK 8)
1.8.x

Gradle
6.8.3

 	
```
    $ npm install -g cordova@10.0.0
```

```
    $ npm install -g ionic@6.15.0
```

NOTE: This app is built and tested on ionic-native/core@^5.0.0.


## Installation of this project

* Clone git repository

* Install npm dependecies (Shortcut install.bat)

```
    $ npm install
```

* Add Platform (whichever required)

```
    $ ionic cordova platform add android@9.0.0
```

* Update plugins

```
    $ npm install -g cordova-check-plugins
    $ cordova-check-plugins --update=auto
```

* Run patch befor building the app !

```
    $ node patch.js
```


* Care for clean code, so use lint:

```
    $ npm run lint
```


* Build the app (Shortcut build.bat)

```
    $ ionic cordova build android --release
```


* Run app on Android Studio Emulator (Shortcut run.bat)

```
    $ ionic cordova run android -l
```
