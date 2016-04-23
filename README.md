# cord

**cord** is chat bot framework, currently supporting IRC and Discord, as well
as the name of our personal bot residing the *#obsidian Research* IRC channel
and Discord server. This is undoubtedly the best bot written JavaScript. If you
openly disagree, you'll hurt its feelings. cord identifies as an agender
robot-kin and prefers the pronoun "it".

## Features

One of cord's strengths is its modularity:

- **Sockets** provide a common interface for dealing with different services.
- **Plugs** is just our obviously *brilliant* way of saying "plugins".
  I *know* you like it!

The common interface makes it easy to write a plug that works for all sockets.
As an example, the [Bridge](https://github.com/copygirl/cord/blob/master/plugs/Bridge.js)
plug provides bridging functionality, meaning you can link multiple channels
together, regardless of the socket they belong to, and have messages relayed
between those channels. This includes messages sent by cord itself, so any
other plug can simply reply to incoming messages, and the reply will also be
relayed to the other bridged channels.

Something else noteworthy to point out is cord's message structure: Other than
containing vital information such as time, sender and target, messages are made
of **parts**. A part is either a plain string or an object that can be
`toString`ed to something reasonable, such a User instance returning the user's
name. Alternatively, a socket's message sending implementation can turn the
object into something better looking or appropriate for that socket:
Formatting, mentions, actions, newlines, ...

### Plugins

- **Logging**: Currently only logs messages to the console.
- **Respawn**: Automatically reconnects sockets because shit happens.
- **Bridge**: Relays messages between linked channels.
- **React**: Adds and responds to commands (basic and regex).

## Installation

```
git clone https://github.com/copygirl/cord.git
cd cord
npm install
```

## Configuration

When cord starts up, it will look for `auth.json` and `config.json` in the main
directory. As you can probably tell these two files are not included in the
repository, since it'd be too difficult to provide informative sample configs.
Instead, information on *all the things* can be found on the [wiki](https://github.com/copygirl/cord/wiki).

## Usage

```
npm start
```

## License

![](https://github.com/copygirl/cord/raw/master/LICENSE.gif)  
_**cord** doesn't have  
a care in the world._
