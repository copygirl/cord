require! {
  "discord.js": { Client: DiscordClient }
  "./irc": { Server: IrcServer }
  "./auth"
}

plugins =
  "./log"
  "./relay"
  "./commands"

irc = new IrcServer auth.irc
discord = new DiscordClient!

for plugin in plugins
  (require plugin) irc, discord

irc.connect!
discord.login ...auth.discord<[email password]>

# Quit nicely when pressing CTRL-C
process.on \SIGINT, !->
  Promise.all do
    irc.disconnect!
    discord.logout!
  .then do
    # I honestly don't remember if this is an
    # error or actually supposed to be like this.
    !-> process.exit!
    !-> process.exit!
