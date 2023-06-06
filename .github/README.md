<p align="center">
  <a align="center" href='#'/>
    <img src="assets/OMEGALUL.webp" width="150rem" />
  </a>
</p>

<h1 align="center">OMEGALUL Counter</h1>

<p align="center">
    <b>Counts OMEGALUL emotes used while a streamer is live and saves it to a Firebase realtime database.</b>
    <br/>
    <b>Written in Typescript, using Node.</b>
</p>

<p align="center">
    <a href="https://github.com/Dan-Mizu/OMEGALUL-Counter/issues" target="_blank">
        <img height="30rem" src="https://img.shields.io/github/issues/Dan-Mizu/OMEGALUL-Counter?color=red&style=for-the-badge" alt="Issues"/>
    </a>
    <a href="https://github.com/Dan-Mizu/OMEGALUL-Counter/commits" target="_blank">
        <img height="30rem" src="https://img.shields.io/github/last-commit/Dan-Mizu/OMEGALUL-Counter?color=darkgreen&style=for-the-badge" alt="Last Commit"/>
    </a>
</p>

<p align="center">
    Fork and create a <code>config.json</code> file within the config directory using the example file and fill it out to the best of your ability.
    <br/>
    <br/>
    You will need to setup a Firebase realtime database, and use the credentials from it. You will also need to create a Twitch app, and use the client ID and secret from it.
    <br/>
    <br/>
    Get the user ID of the twitch streamer of your choice and put it in the config. By default, this app measures the OMEGALUL emote, but can measure any enabled 7tv emote in the channel.
    <br/>
    <br/>
    In development, this uses nginx to automatically generate SSL and receive webhook events from twitch, but you will want to setup the webhook with or without reverse proxy yourself for production.
</p>
