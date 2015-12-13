require! "prelude-ls": { find }

export discord-find-channel = (discord, channel) ->
  discord.channels |> find (ch) -> "##{ch.name}" == channel?.name ? channel

export discord-send-channel = (discord, channel, message) !->
  ch = discord-find-channel discord, channel
  discord.send-message ch, message if ch

export discord-to-irc = (discord, message) ->
  text = message.content.replace /[\r\n]+/, " "
  for user in message.mentions
    text .= replace "#user", "@#{user.username}"
  for channel in discord.channels
    text .= replace "#channel", "##{channel.name}"
  for attachment in message.attachments
    text += " #{attachment.url}"
  text

export irc-to-discord = (text, discord) ->
  if text.index-of "@" >= 0
    for user in discord.users
      text .= replace "@#{user.username}", "#user"
  if text.index-of "#" >= 0
    for channel in discord.channels
      text .= replace "##{channel.name}", "#channel"
  text
