require! {
  irc
  "./common"
  "./promise"
}


default-options =
  server: null      # [REQUIRED] IP of the server, for example "irc.esper.net"
  port: 6667        #  ( Port of the server, defaults to 6667 )
  server-name: null #  ( Fancy disply name for the server, like "Esper.NET" )
  channels: []      #  ( Default channels to join once connected )
  
  nick: null        # [REQUIRED] Preferred nick to use
  password: null    #  ( Password used to identify with NickServ )
  user-name: null   #  ( User name, defaults to nick )
  real-name: null   #  ( Real name, defaults to nick )
  
  # These should stay on default
  auto-connect: false
  flood-protection: true
  strip-colors: true
  retry-count: 5


default-part-reasons =
  "Brb food."
  "What is life?"
  "Oh the humanity!"
  "I wanna be a real girl!"
  "No! Don't take me away! T_T"
  "Beep boop, I take american jobs."
  "I am a robot, you do not scare me... AHH!"

default-quit-reasons =
  "I blame copygirl."
  "Critical error ..."
  "Curse you Merasmus!"
  "Robots aren't supposed to be funny."
  "01110000 01100101 01101110 01101001 01110011"
  "In case of malfunction, contact [INSERT OWNER HERE]."
  "48 61 70 70 79 20 42 69 72 74 68 64 61 79 20 43 6D 65 21"

random = (array) ->
  array[Math.floor  Math.random! * array.length]


export class Client extends common.Client
  -> super "irc"
  
  close: (reason, callback) ->
    if typeof! reason == \Function
      callback = reason
      reason = null
    if Object.keys @servers .length == 0
      return Promise.reject new Error "Not connected to any servers"
    else Promise.all do
      for _, server of @servers
        server.disconnect reason


export class Server extends common.Server
  @_irc = null
  @_opt = null
  
  (client, options) ->
    if client !instanceof Client
      options = client
      client = null
    super client, options.server, options.server-name ? options.server
    
    if @client?
      @client.servers[@id] = @
      @on \connect,    (user)         !~> @client.emit \connect, @, user
      @on \disconnect, (user, reason) !~> @client.emit \disconnect, @, user, reason
      @on \join,  (channel, user)         !~> @client.emit \join, channel, user
      @on \leave, (channel, user, reason) !~> @client.emit \leave, channel, user, reason
      @on \message, (message)     !~> @client.emit \message, message
      @on \rename,  (target, old) !~> @client.emit \rename, target, old
    
    nick = options.nick
    options.user-name ?= nick
    options.real-name ?= nick
    @_opt := default-options with options
    
    @self = @users[nick] = new User this, nick, false <<<
      user-name: options.user-name
      real-name: options.real-name
    
    @self.once \connect, !~>
      # If name was changed by server, update own user
      if @self.name != @_irc.nick
        rename.call @, @self, @_irc.nick
  
  rename = (user, nick) !->
    old = user.name
    user.name = nick
    
    delete @users[old]
    @users[nick] = user
    for ch, channel of user.channels
      delete channel.users[old]
      channel.users[nick] = user
    if user.names.unshift old > common.username-history-length
      user.names.pop!
    
    @emit \rename, user, old
    for ch, channel of user.channels
      channel.emit \rename, user, old
    user.emit \rename, old
  
  part = (channel, user, reason, before-emit) !->
    delete channel.users[user.name]
    delete user.channels[channel.name]
    delete user.modes[channel.name]
    
    if user.own
      channel.joined = false
      delete @channels[channel.name]
    else if Object.keys user.channels .length == 0
      delete @users[user.name]
    
    @emit \leave, channel, user, reason
    channel.emit \leave, user, reason
    user.emit \leave, channel, reason
  
  quit = (user, reason, before-emit) !->
    user.online = false
    delete user.servers[@id]
    
    for ch, channel of user.channels
      part.call @, channel, user, reason
    
    if user.own
      @_irc := null
      delete @client.servers[@id] if @client
    
    before-emit? @
    @emit \disconnect, user, reason
    for ch, channel of user.channels
      channel.emit \disconnect, user, reason
    user.emit \disconnect, reason
  
  message = (from, to, text, merge = {}) ->
    # If from is undefined, the
    # message is from the server
    if !from?
      from = this
      to = @self
    if typeof! from == \String
      from = @users[from] ?= new User this, from
    if typeof! to == \String
      to = @channels["#to"] ? @users["#to"]
    
    channel = if to instanceof User
      other = if to.own then from else to
      name = if other instanceof User then other.name else other.id
      @channels[name] ?= new PrivateChannel this, other
    else to
    
    message = new common.Message new Date!, from, to, text
    message <<< merge
    
    if (channel.messages.unshift message) > common.channel-history-length
      channel.messages.pop!
    if user? and (user.messages.unshift message) > common.user-history-length
      user.messages.pop!
    
    @emit \message, message
    channel.emit \message, message
    user?.emit \message, message
    
    message
  
  connect: (callback) ->
    (resolve, reject) <~! promise callback
    if @_irc?
      return reject new Error "Already connected / connecting to #{@server}"
    
    @_irc := new irc.Client null, null, @_opt
    
    @_irc.on \motd, (motd) !~>
      old = @motd
      @motd = motd
      @emit \motd, motd, old
    
    @_irc.on \join, (ch, nick) !~>
      channel = @channels[ch] ?= new Channel this, ch
      user    = @users[nick]  ?= new User this, nick
      
      channel.users[nick] = user
      user.channels[ch] = channel
      user.modes[ch] = UserMode.normal
      
      # Delay join event of own user
      # until names are available
      if user.own then return
      
      @emit \join, channel, user
      channel.emit \join, user
      user.emit \join, channel
    
    @_irc.on \names, (ch, nicks) !~>
      channel = @channels[ch]
      
      for nick, level of nicks
        user = @users[nick] ?= new User this, nick
        channel.users[nick] = user
        user.channels[ch] = channel
        user.modes[ch] = level
      
      if channel.joined then return
      channel.joined = true
      
      @emit \join, channel, @self
      channel.emit \join, @self
      @self.emit \join, channel
    
    @_irc.on \topic, (ch, topic, by) !~>
      channel = @channels[ch]
      old = channel.topic
      channel.topic = topic
      channel.emit \topic, old
    
    @_irc.on \part, (ch, nick, reason) !~>
      part.call @, @channels[ch], @users[nick], "Left: #reason"
    @_irc.on \kick, (ch, nick, by, reason) !~>
      part.call @, @channels[ch], @users[nick], "Kicked by #by: #reason"
    
    @_irc.on \quit, (nick, reason) !~>
      quit.call @, @users[nick], "Quit: #reason"
    @_irc.on \kill, (nick, reason) !~>
      quit.call @, @users[nick], "Killed: #reason"
    @_irc.on \abort, !~>
      quit.call @, @self, "Connection lost"
    
    @_irc.on \nick, (old, nick, chans) !~>
      rename.call @, @users[old], nick
    
    @_irc.on \message, (from, to, text) !~>
      message.call @, from, to, text
    @_irc.on \action, (from, to, text) !~>
      message.call @, from, to, text, { +action }
    @_irc.on \notice, (from, to, text) !~>
      message.call @, from, to, text, { +notice }
    
    @_irc.on \+mode, (ch, by, mode, arg) !~>
      channel = @channels[ch]
      switch mode
        case \v => @users[arg]?.modes[ch] += "+"
        case \o => @users[arg]?.modes[ch] += "@"
    
    @_irc.on \-mode, (ch, by, mode, arg) !~>
      channel = @channels[ch]
      switch mode
        case \v => @users[arg]?.modes[ch] -= "+"
        case \o => @users[arg]?.modes[ch] -= "@"
    
    @_irc.on \abort (times) !~>
      reject new Error "Failed to connect to #{@server}, giving up after #times tries"
    
    @_irc.once \registered, !~>
      @self.online = true
      resolve!
      @emit \connect, @self
      @self.emit \connect
    
    @_irc.connect!
  
  disconnect: (reason, callback) ->
    if typeof! reason == \Function
      callback = reason
      reason = null
    (resolve, reject) <~! promise callback
    if !@_irc?
      return reject new Error "Not connected to #{@server}"
    reason ?= random default-quit-reasons
    @_irc.disconnect reason, (err) !~>
      if err then return reject err
      quit.call @, @self, reason, resolve
  
  quit: -> @disconnect ...
  
  join: (channel, callback) ->
    (resolve, reject) <~! promise callback
    if !@connected
      return reject new Error "Not connected to #{@server}"
    if @channels[channel]
      return reject new Error "Already joined #channel"
    irc.join channel, (err) !~>
      if err then return reject err
      resolve @channels[channel]
  
  part: (channel, reason, callback) ->
    if typeof! reason == \Function
      callback = reason
      reason = null
    (resolve, reject) <~! promise callback
    if !@connected
      return reject new Error "Not connected to #{@server}"
    if typeof! channel == \String
      ch = channel
      channel = @channels[channel]
    else ch = channel.name
    if !channel? or !channel.joined
      return reject new Error "Not joined #{channel ? ch}"
    reason ?= random default-part-reasons
    irc.part channel.name, (err) !~>
      if err then return reject err
      resolve channel
  
  send: (to, text, callback) ->
    (resolve, reject) <~! promise callback
    if (typeof! to == \String and to.startsWith "#" and !@channels["#to"]) or
       (to instanceof Channel and !to.joined)
      return reject new Error "Not joined #to"
    @_irc.say to.toString!, text
    resolve message.call @, @self, to, text
  
  notice: (to, text, callback) ->
    (resolve, reject) <~! promise callback
    if (typeof! to == \String and to.startsWith "#" and !@channels["#to"]?) or
       (to instanceof Channel and !to.joined)
      return reject new Error "Not joined #to"
    @_irc.notice to.toString!, text
    resolve message.call @, @self, to, text, { +notice }
  
  nick: (name, callback) ->
    (resolve, reject) <~! promise callback
    if !@connected then return reject new Error "Not connected"
    listener = !~>
      if typeof! it == \String
        # @self.on "rename" => successful!
        resolve!
      else switch it.command.to-lower-case!
        case \err_erroneusnickname => reject new Error "Erroneus nickname"
        case \err_nicknameinuse    => reject new Error "Nickname in use"
        default => return
      @remove-listener \error, listener
      @self.remove-listener \rename, listener
    @on \error, listener
    @self.on \rename, listener


export class Channel extends common.Channel
  (server, name) ->
    super server, name, name
  
  send: (text, callback) ->
    @server.send this, text, callback
  notice: (text, callback) ->
    @server.notice this, text, callback

export class PrivateChannel extends Channel
  (server, @other) ->
    super server, @other.name
    @users[@server.self.name] = @server.self
    if @other instanceof User
      @users[@other.name] = @other


export class User extends common.User
  modes: {}
  user-name: null
  real-name: null
  
  (@server, name, @online = true) ->
    super @server.client, name
    @server.users[name] = this
    @servers[@server.id] = @server
  
  send: (text, callback) ->
    @server.send this, text, callback
  notice: (text, callback) ->
    @server.notice this, text, callback
  
  set-name: (name, callback) ->
    if !@own then Promise.reject do
      new Error "Can only rename self"
    else @server.nick name, callback

export UserMode =
  normal: ""
  voice: "+"
  operator: "@"
