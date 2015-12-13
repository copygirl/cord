require! {
  events: EventEmitter
}


# The maximum size of Channel.messages to keep for future generations
#   If you're planning to keep messages around for logging purposes, I recommend
#   doing this manually, since messages might be heavy objects (like event emitters)
export channel-history-length = 64

# The maximum size of User.messages to keep
export user-history-length = 64

# The maximum size of User.names to keep
export username-history-length = 16


export class Client implements EventEmitter::
  # id:       # String identifier for the client (such as "irc")
  self: null  # Own user object representing the client, if available
  servers: {} # Known servers
  users: null # Known users, if available
  
  (@id) ->
    if @@@ == Client then ...
  
  # Disconnects from all servers and/or the service
  # callback: (err)
  close: (callback) !-> ...
  
  # on "connect",    (target, user)         - User connected
  # on "disconnect", (target, user, reason) - User disconnected
  # on "join",       (target, user)         - User joined server / channel
  # on "leave"       (target, user, reason) - User left server / channel
  # on "rename",     (target, old)          - Name of server / channel / user changed
  # on "message",    (message)              - Message received / sent


export class Server implements EventEmitter::
  # client:    # The client this server belongs to
  # id:        # Unique identifier for this server
  # name:      # Name or human-readable string representation of the server
  self: null   # Own user object representing the client
  users: {}    # Known users on the server
  channels: {} # Known / joined channels on the server
  motd: null   # Message of the day, if available
  connected:~  # Is the client connected to this server?
    -> @self.online
  
  (@client, @id, @name) ->
    if @@@ == Server then ...
  
  # Connects / reconnects to the server
  # callback: (err)
  connect: (callback) !-> ...
  
  # Disconnects / leaves from the server
  # callback: (err)
  disconnect: (callback) !-> ...
  
  to-string: -> @name
  
  # on "connect",    (user)                  - User connected
  # on "disconnect", (user, reason)          - User disconnected
  # on "join",       (channel, user)         - User joined channel
  # on "leave",      (channel, user, reason) - User left channel
  # on "message",    (message)               - Message received / sent
  # on "rename",     (target, old)           - Name of server / channel / user changed
  # on "motd",       (motd, old)             - Message of the day received / changed


export class Channel implements EventEmitter::
  # client:     # The client this channel belongs to
  # server:     # The server this channel is hosted on
  # id:         # Unique identifier for this channel
  # name:       # Name or human-readable string representation of the channel
  joined: false # Is the client in this channel?
  users: {}     # Users currently in the channel
  messages: []  # Messages received from this channel, most recent first
  topic: null   # Topic of the channel, if available
  
  (@server, @id, @name) ->
    @client = @server.client
  
  # Sends a message to the channel
  # callback: (err, message)
  send: (text, callback) -> ...
  
  to-string: -> @name
  
  # on "connect",    (user)         - User in channel connected
  # on "disconnect", (user, reason) - User in channel disconnected
  # on "join",       (user)         - User joined channel
  # on "leave",      (user, reason) - User left channel
  # on "message",    (message)      - Message sent to this channel
  # on "rename",     (target, old)  - Name of channel / user changed
  # on "topic",      (topic, old)   - Topic received / changed


export class User implements EventEmitter::
  # client:     # The client this user was created for
  # name:       # Current name of this user, may change
  id: null      # Unique identifier for this user, if available
  names: []     # Previous names of this user, contains
                # objects with time and name properties
  online: false # Is this user online?
  servers: {}   # Server this user is known to be in
  channels: {}  # Channels the user is known to be in
  messages: []  # Messages sent by this user, most recent first
  own:~         # Is this the user representing the client?
    -> @server.self == this
  
  (@client, @name) ->
    if @@@ == User then ...
  
  # Sends a private message to the user
  # callback: (err, message)
  send: (text, callback) -> ...
  
  # Sets the name of the user
  # Probably only works if this is the client user
  # callback: (err)
  set-name: (name, callback) -> ...
  
  to-string: -> @name
  
  # on "connect",                      - User connected
  # on "disconnect", (reason)          - User disconnected
  # on "join",       (channel)         - User joined channel
  # on "leave",      (channel, reason) - User left channel
  # on "message",    (message)         - Message sent by this user
  # on "rename",     (old)             - Name of user changed


export class Message
  # client:     # The client this message was received on
  # server:     # The server this message was received on
  # time:       # Time at which the message was received / sent (as Date object)
  # from:       # The source of this message, may be Server or User
  # to:         # The target of this message, may be Channel or User
  # text:       # Current plain text of this message (may be null if deleted)
  id: null      # Unique ID of the message, if available
  
  user: null    # User this message was sent by, if any
  channel: null # Channel this message was sent to, if any
  action: false # Is this message an action, like "* copygirl cries"?
  own:~         # Was this message sent by the client?
    -> @server.self == @from
  mentions: []  # Array of known users / channels that were mentioned
  
  (@time, @from, @to, @text) ->
    @server  = if @from instanceof Server then @from else @from.server
    @client  = @server.client
    @user    = @from if @from instanceof User
    @channel = @to if @to instanceof Channel
  
  to-string: -> @text


export class EditableMessage extends Message implements EventEmitter::
  revisions: []    # Array of known previous revisions of the message,
                   # contains objects with time and text properties
  deleted:~        # Has this message been deleted?
    -> !@text?
  canEdit: false   # Can this message be edited by this client?
  canDelete: false # Can this message be deleted by this client?
  
  (time, from, to, text) ->
    super ...
    if @@@ == EditableMessage then ...
  
  # Edits the message
  # callback: (err)
  edit: (text, callback) -> ...
  
  # Deletes the message
  # callback: (err)
  delete: (callback) -> ...
  
  # on "edit",   (oldtext) - Message was edited
  # on "delete", (oldtext) - Message was deleted
