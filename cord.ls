require! {
  "discord.js": { Client: DiscordClient }
  "./irc": { Server: IrcServer }
  "./auth"
}

plugins =
  "./log"
  "./relay"
  "./commands"

if auth.irc?
  irc = new IrcServer auth.irc
  irc.connect (err) !-> if err?
    console.error err
    process.exit!
else console.log "[= IRC =] No channel selected!"

discord = new DiscordClient!

# Loading modules, irc parameter is optional, may be undefined
for plugin in plugins
  (require plugin) discord, irc

discord.login ...auth.discord<[email password]>

# Quit nicely when pressing CTRL-C
process.on \SIGINT, !->
  Promise.all do
    irc?.disconnect!
    discord.logout!
  .then do
    # I honestly don't remember if this is an
    # error or actually supposed to be like this.
    !-> process.exit!
    !-> process.exit!
