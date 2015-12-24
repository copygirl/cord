require! "./util"

module.exports = (discord, irc) !->
  irc?.self.on \connect, !-> console.log do
    "[= IRC =] We hacked into their mainframes, sir!"
  discord.on \ready, !-> console.log do
    "[Discord] Ready to serve, copy-sensei."
  
  irc?.on \message, (message) !->
    if message.notice then return
    console.log "[= IRC =]",
      if message.channel? then "[#{message.to}]"
        else if message.to.own then "(#{message.to})"
      if message.action then "* #{message.from}"
        else if message.notice then "-#{message.from}-"
        else "<#{message.from}>"
      "#message"
  
  discord.on \message, (message) !->
    channel = message.channel.name
    user = message.author.username
    text = util.discord-to-irc discord, message
    console.log "[Discord] [##channel]",
      if /^\*[^\*]+\*$/g.test text
        then "* #user #{text.substr 1, text.length - 2}"
        else "<#user> #text"
