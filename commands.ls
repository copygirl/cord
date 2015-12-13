require! {
  "./common"
  "./util"
}

ignored = {
  # Ignored users, like other bots cord would love
  # to chat with all day, but probably shouldn't.
  # +Inumuta
}

command-prefix = "~"

commands =
  about: "I am cord, a bot written by copygirl."

context =
  * /^cord[:,] .*[^\?]$/g
    * "..." "Meh." "Pff.." "Duh." "<3"
      "...?" "What?" "Huh?" "Njeh~?" "Wheh..?" "Ueh~?"
      "Nya~" "Nyan~" "Pomf~" "Ugu~" "Duhuhu~" "Derp."
      "Heh." "Hahaha~" "Hehe~" "Lol!" "Lmao!" "Rofl!"
      "Dude.." "Wow." "Woah." "No way!" "Totes!"
      "I agree." "Totally." "Yup." "Yeah."
      "What the..?" "*shakes head*" "I am disappoint."
      "I have nothing to say." "No comment." "Please."
      "That is so stupid." "I'm so sick of this.."
      "My body is ready." "What is love?" "Sorry."
      "Beep." "Boop." "Beep boop." "Curse you, Merasmus!"
      "Foo." "Bar." "Foobar." "Fubar." "Baz." "Quux."
      "Kill all humans!" "Exterminate!" "I AM ROBOT"
      "Please, say my name again." "Talk to me more."
      "I'm here for you." "Don't stop." "Continue."
      "Please ask copygirl to add more responses."
  
  * /^cord[:,] .+\?$/g
    * "Yes!" "Yes." "Yeah." "Heck yeah!" "Sure."
      "For sure!" "Totally." "Positive." "True."
      "No!" "No." "Nah." "Nope." "Doubt it."
      "No way!" "Nooooo!" "Negative." "False."
      "Probably." "Probably?" "Probably not."
      "I don't know!" "I dunno..." "I guess?"
      "Maybe." "Maaaaaybe..?" "Pff, maybe.."
      "Why are you asking me this?" "What?!"
      "Are you out of your mind?" "What the fueh?"
      "I have no opinion." "No idea." "I won't tell."
      "Insufficient data." "Computation error."
  
  * /\b([1-9]\d{0,1})d([2-9]|[1-9]\d{1,2})\b/g, (data, matches) ->
      if matches.length > 4 then return
      total-dice = 0
      total-result = 0
      for [, num, size] in matches
        [num, size] = [+num, +size]
        total-dice += if num <= 8 then num else 1
      all-str = (for [, num, size] in matches
        [num, size] = [+num, +size]
        result = 0
        str = ""
        for i til num
          result += roll = 1 + Math.floor Math.random! * size
          str += "#roll, " if total-dice <= 16 and num <= 8
        total-result += result
        average = (Math.round result / num * 10) / 10
        if num > 1
          if total-dice <= 16 and num <= 8
            str = "( #{str.substr 0, str.length - 2} ) "
          "#{num}d#size = #result #str~ #average"
        else "1d#size = #result"
      ) * " [+] "
      if matches.length == 1 then all-str
      else "#all-str [=] #total-result"

respond = ({ irc, discord, message }: data, response, args) !->
  if !response? then return
  if typeof! response == \Array
    return respond data, response[Math.floor Math.random! * response.length], args
  if typeof! response == \Function
    return respond data, response data, args
  
  if message instanceof common.Message
    user = "#{message.user}"
    message.channel.send "\x02#user\x0F: #response"
    
    # Without set-immediate, somehow sends
    # response before sending relayed message
    set-immediate util.discord-send-channel,
      discord, message.channel, "**#user**: #response"
  else
    discord.send-message message.channel, "#{message.author}: #response"
    channel = "##{message.channel.name}"
    user = message.author.username
    if channel of irc.channels
      irc.send channel, "\x02#user\x0F: #response"

on-message = (data, text) !->
  if text.starts-with command-prefix
    text .= substr command-prefix.length
    i = text.index-of " "
    [command, text] = if i < 0 then [text, ""]
      else [(text.substr 0, i), text.substr i + 1]
    cmd = commands[command]
    return respond data, cmd, text if cmd?
  for [regex, cmd] in context
    args = while (a = regex.exec text)? then a[0 to a.length]
    return respond data, cmd, args if args.length > 0

module.exports = (irc, discord) !->
  irc.on \message, (message) !->
    if message.channel? and !message.notice and
       !message.own and message.user.name !of ignored
      on-message { irc, discord, message }, message.text
  discord.on \message, (message) !->
    if message.author.id != discord.user.id and
       message.author.id !of ignored
      on-message { irc, discord, message }, message.content
