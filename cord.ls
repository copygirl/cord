require! {
  "discord.js": { Client: DiscordClient }
  "./irc": { Server: IrcServer }
  "./auth"
}

# Plugins to load from the local folder
plugins =
  "./log"
  "./relay"
  "./commands"
  "./voice"

# Finalize
finalize = !->
  Promise.all do
    irc?.disconnect!
    discord.logout!
  .then do
    # I honestly don't remember if this is an
    # error or actually supposed to be like this.
    !-> process.exit!
    !-> process.exit!

# Connecting to IRC
if auth.irc?
  irc = new IrcServer auth.irc
  console.log "[= IRC =] Connecting to #{auth.irc.server}"
  irc.connect (err) !-> if err?
    console.error "[= IRC =] #err"
    finalize!
else console.log "[= IRC =] No channel selected!"

discord = new DiscordClient!

# Loading modules, irc parameter is optional, may be undefined
for plugin in plugins
  (require plugin) discord, irc

# Connect to discord
console.log "[Discord] Connecting"
discord.login ...auth.discord<[email password]>, (err) !-> if err?
  console.error "[Discord] #err"
  finalize!

# Quit nicely when pressing CTRL-C
process.on \SIGINT, !-> finalize!
