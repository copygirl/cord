"use strict";

let Plug = require("./Plug");
let { MaxBulkDeletableMessageAge } = require("discord.js");

let { extend } = require("../utility");

const HOUR = 60 * 60 * 1000;

let defaults = {
  runEvery: 6, // hours
  // Due to Discord API limitations, messages older than 14 days can't be deleted.
  // So for this plug to work, you have to set it to something less than that.
  deleteOlderThan: 12 * 24, // hours
  channels: [ ]
};


module.exports = class Housekeeping extends Plug {
  
  constructor(cord, config) {
    super(cord, extend({}, defaults, config));
  }
  
  activate() {
    setInterval(async () => {
      let olderThan = Date.now() - this.config.deleteOlderThan * HOUR;
      for (let resolveStr of this.config.channels) {
        let [ type, [ channel ] ] = this.cord.resolve(resolveStr);
        if (channel == null) { this.error(`Could not resolve '${resolveStr}'`); continue; }
        let discordChannel = channel._discordChannel;
        if (discordChannel == null) { this.error(`${resolveStr} is not a Discord channel`); continue; }

        let deleted = await this.cleanup(discordChannel, olderThan);

        if (deleted > 0) {
          let dateStr = new Date(olderThan).toISOString();
          dateStr = `${dateStr.slice(0, 10)} ${dateStr.slice(11, 11 + 8)}`;
          this.info(`Deleted ${deleted} message(s) before ${dateStr}`);
        }
      }
    }, this.config.runEvery * HOUR);
  }
  
  async cleanup(channel, olderThan) {
    const FETCH_LIMIT = 100; // Number of messages that can be fetched at once.

    function isRecent(message) {
      return Date.now() - message.createdTimestamp < MaxBulkDeletableMessageAge;
    }

    function shouldDelete(message) {
      return !message.pinned                        // Not pinned.
          && (message.createdTimestamp < olderThan) // Older than specified.
          && isRecent(message);                     // Recent enough for bulk-delete.
    }
    
    let totalDeleted = 0;
    let before = null;

    while (true) {
      let messages = await channel.messages.fetch({ limit: FETCH_LIMIT, cache: false, before });
      if (messages.size == 0) break; // No more messages.
      if (!isRecent(messages.first())) break; // Messages are too old to bulk-delete.
      before = messages.last().id; // Next fetch, show messages before the oldest one we fetched.

      let toDelete = messages.filter(shouldDelete);
      totalDeleted += await channel.bulkDelete(toDelete);

      // Wait a few seconds before fetching more messages. Let's be nice to Discord.
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return totalDeleted;
  }
  
};
