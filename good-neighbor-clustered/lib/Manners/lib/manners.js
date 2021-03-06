/**
 * Instantiate and return Manners
 *
 * @class
 * @classdesc Module tasked with determining the appropriateness of:
 * 1. Incoming tweets based on key characterstics of their content
 * 2. Outgoing Conviviality actions based on recent bot behavior
 *
 * @author Zack Proser
 *
 * @param {object} settings - Settings object based on config.json
 * @param {object} channel - Main EventEmitter instance shared by modules for PubSub
 */
class Manners {
    constructor() {
        this.init();
    }

    /**
     * Setup behavior tracking variables
     *
     * @param {object} settings - Settings object based on config.json
     * @param {object} channel - Main EventEmitter instance shared by modules for PubSub
     */
    init() {
        this.users_to_ignore;
        this.rewteet_disqualifiers;
        this.lastRetweetedUser = 'Booker DeWitt';
        this.lastFavoritedUser;
        this.lastThankedUser;
        this.lastThankedUsers = [];
        this.lastWelcomedUser;

        /**
         * Initially set lastSource to random source
         */
        this.lastSource = app.get('settings').scraper.feeds.random();

    }

    /**
     * Setters
     */

    /**
     * Updates variable tracking the last user that bot retweeted
     * @param  {object} tweet - The tweet containing the user who bot just retweeted
     */
    updateLastRetweetedUser(tweet) {
        this.lastRetweetedUser = tweet.user.screen_name;
    }

    /**
     * Updates variable tracking the last user whose tweet bot favorited
     * @param  {object} tweet - The tweet containing the user whose tweet bot just favorited
     */
    updateLastFavoritedUser(tweet) {
        this.lastFavoritedUser = tweet.user.screen_name;
    }

    /**
     * Updates variable tracking the last user that bot thanked
     * @param  {object} tweet - The tweet containing the user who bot just thanked
     */
    updateLastThankedUser(tweet) {
        this.lastThankedUser = tweet.user.screen_name;
    }

    /**
     * Checks if a content resource returned by a feed
     *
     * or read out from the mongo pulled_articles collection
     *
     * is a valid feed resource that can be stored or used to compose a tweet
     *
     * @param  {String}  title         The title of the feed-fetched content resource
     * @param  {String}  origin        The domain-ish origin of the content
     * @param  {String}  original_link Should be a valid link to the article
     *
     * @return {Boolean}               Whether or not the content resource is valid
     */
    isAValidFeedContentItem(title, origin, original_link) {
        if (
            typeof title === "undefined" || title == null || title == '' || typeof title != "string" || typeof origin === "undefined" || origin == null || typeof origin != "string" || origin == '' || typeof original_link === "undefined" || original_link == null || typeof original_link != "string" || original_link == ''
        ) {
            return false;
        }
        return true;
    }

    /**
     * Helper method to check if a single user has already been thanked
     */
    userHasBeenThanked(user_id, callback) {
        if (!user_id) callback(new Error('Manners.userHasBeenThanked: no user_id supplied.'));

        app.get('welcomed_user_tweet_ids').findOne({ user_id: user_id }, ((err, doc) => {
            if (err) {
                callback(new Error('Manners.userHasBeenThanked: error fetching user from mongo ' + err));
            }
            if (doc) {
                callback(null, true);
            } else {
                callback(null, false);
            }
        }))
    }

    /**
     * Adds user to collection that saves the ids of tweets that bot
     * Has posted a "You're Welcome" tweet in reference to
     *
     * @param {object} tweet - The tweet whose ID should be recorded as having received a "You're Welcome" response
     */
    addWelcomedUser(tweet) {
        if (typeof tweet.user.id_str == "undefined") {
            app.get('logger').error('addWelcomedUser: could not find tweeting user id_str ')
            return
        }
        app.get('welcomed_user_tweet_ids').insert({ user_id: tweet.user.id_str, time: tweet.created_at }, ((err, result) => {
            if (err) {
                if (err.code = 11000) {
                    app.get('logger').info('Manners attempted to save already welcomed user - record not written')
                    return
                } else {
                    app.get('logger').error(err)
                    return
                }
            }
            app.get('logger').info('Manners: updateLastWelcomedUser saved tweet id_str: ' + tweet.user.id_str)
        }))
    }

    /**
     * Updates the variable tracking which content source
     * The bot last posted an article from
     *
     * Designed to assist in increasing organic appearance
     * Of content sharing behavior and prevent posting
     * Similar content in sequence
     *
     * @param  {string} source - the name of the content source whose article was just posted
     * This source string matches the source name stored in the Mongo 'pulled_articles' collection
     *
     */
    updateLastSource(source) {
        this.lastSource = source
    }


    /**
     * Updates the collection tracking the users that the bot has thanked
     *
     * @param  {array} users - Array of username strings of users who have been thanked
     */
    updateLastThankedUsers(users) {
        this.lastThankedUsers = users

        let document_array = []

        users.forEach((user) => {
            document_array.push({ username: user })
        });

        app.get('thanked_users').insert(document_array, ((err, result) => {
            if (err) {
                if (err.code == 11000) {
                    app.get('logger').info('thanked_users already has record of this user. Record not written ')
                } else {
                    app.get('logger').error(err)
                }
            }
            app.get('logger').info('Manners updated thanked_users collection with: ')
            console.dir(document_array)
        }))
    }

    /**
     * Getters
     */

    /**
     * Returns the username of the last user bot thanked
     *
     * @return {string} username - The username of the last user bot thanked
     */
    getLastRetweetedUser() {
        return this.lastRetweetedUser;
    }

    /**
     * Returns the username of the last user whose content bot favorited
     *
     * @return {string} username - The username of the last user whose content bot favorited
     */
    lastFavoritedUser() {
        return this.lastFavoritedUser;
    }

    /**
     * Returns an array containing the user ids of the users bot has already said "You're Welcome" to
     *
     * @param  {getWelcomedUsersCallback} callback - Function to return array of user ids
     */
    getWelcomedUsers(callback) {
        //Only return a list of tweet_ids to the calling function
        //Instead of filtering for this manually in node - which is likely slower
        app.get('welcomed_user_tweet_ids').find({}, { user_id: 1 }).sort({ time: -1 }).toArray(((err, results) => {
            if (err) {
                app.get('logger').error(err);
                callback(err);
            }
            app.get('logger').info('Manners: getWelcomedUsers retrieved results: ' + results);
            callback(null, results);
        }))
    }

    /**
     * Returns the username of the last user bot thanked
     *
     * @return {string} username - The username of the user bot last thanked
     */
    lastThankedUser() {
        return this.lastThankedUser;
    }

    /**
     * Returns the source whose content bot last tweeted
     *
     * @return {string} source - The name of the source whose content bot last tweeted
     */
    getLastSource() {
        return this.lastSource;
    }

    /**
     * Returns the username of the user whose content bot last favorited
     *
     * @return {string} username - The username of the user whose content bot last favorited
     */
    getLastFavoritedUser() {
        return this.lastFavoritedUser;
    }

    /**
     * Determines whether or not passed in tweet is 'appropriate' content
     * That should be acted upon, or just some stupid fucking bullshit that should be ignored
     *
     * Designed to prevent bot from interacting with and responding to spam, hatespeech,
     * Or any content that could piss off other users and draw scrutiny toward bot
     *
     * @param  {string} tweet - The tweet to be examined for appropriateness
     * @return {Boolean} isApproriate - The final ruling from the Manners police
     */
    isAppropriate(tweet) { //main quality check to filter out spam & spammers
        var self = this;
        var isEnglish = false;
        var isTooShort = true;
        var containsCrap = false;
        var repeatUser = true;
        var hashSpam = true;
        var shittyUser = false;

        if (typeof tweet.text == "undefined") return false;

        var text = tweet.text.trim().toLowerCase();

        var hashtagCount = (text.match(/#/g) || []).length;

        if (hashtagCount >= 4) {
            app.get('logger').warn("SPAMMY: more than 4 hashtags used - skipping " + text);
            return false;
        } else {
            hashSpam = false;
        }
        if (tweet.user.screen_name.trim().toLowerCase() != this.lastRetweetedUser.trim().toLowerCase()) {
            repeatUser = false;
        } else {
            app.get('logger').warn("Just retweeted this user previously - skipping " + tweet.user.screen_name);
            return false;
        }
        if (tweet.lang == 'en') {
            isEnglish = true;
        } else {
            app.get('logger').warn("Tweet not in English - skipping " + tweet.lang.toUpperCase());
            return false;
        }
        if (tweet.text.length > 40) {
            isTooShort = false;
        } else {
            app.get('logger').warn("Tweet is too short! - skipping: " + tweet.text.length);
            return false;
        }
        app.get('settings').twitter.users_to_ignore.forEach(((u) => {
            if (tweet.user.screen_name.toLowerCase() == u.toLowerCase()) {
                app.get('logger').warn("Tweet is a from an ignored user - skipping: " + tweet.user.screen_name);
                shittyUser = true;
                return false;
            }
        }))
        app.get('settings').twitter.retweet_disqualifiers.forEach(((d) => {
            var pattern = "\\b" + d + "\\b";
            var regex = new RegExp(pattern, "g");
            var matches = regex.exec(text);
            if (matches != null) {
                if (matches.length && typeof matches[0] != "undefined") {
                    app.get('logger').warn("CRAP: " + d + " found in: " + text);
                    containsCrap = true;
                    return false;
                }
            }
        }))

        if (isEnglish == true && isTooShort == false && containsCrap == false && repeatUser == false && hashSpam == false && shittyUser == false) {
            /**
             * It's a quality tweet!
             */
            return true;

        } else {
            /**
             * It's garbage to be ignored
             */
            return false;
        }
    }

    /**
     * Determines whether or not a given tweet is a good candidate for the avatar to retweet
     * @param  {object} tweet - The tweet in question
     * @return {boolean} isAppropriateForRetweeting - whether or not the tweet is appropriate
     */
    isAppropriateForRetweeting(tweet) {
        var text = tweet.text.trim().toLowerCase();

        var contains_keyword = false;

        app.get('settings').twitter.target_hashtags.forEach((keyword) => {
            if (text.indexOf(keyword) > -1) contains_keyword = true;
        });

        return contains_keyword;
    }

    /**
     * Determines whether the passed in tweet is an instance of
     * A user sincerely thanking the bot for an assisting action
     *
     * User must include mention of the action type they are thanking
     * The bot for - reduces likelihood of bot responding to sarcasm
     * Or complexly nuanced language that is not a genuine "Thank You"
     *
     * @param  {string} tweet - The tweet to be examined
     * @return {Boolean} isAThankYou - Whether or not the tweet is a legitimate "Thank You" targeting bot
     */
    isAThankYou(tweet) {
        if (tweet.text == "undefined") return false;
        var
            text = tweet.text.toLowerCase().trim(),
            myname = app.get('settings').bot.name.toLowerCase().trim();

        if (text.indexOf(myname) == -1) return false;

        /**
         * User must make some mention of the action they are saying thanks for - avoid engaging with sarcastic thank yous
         */
        if (!/\brt!?\b|\bretweet!?\b|\bretweeting!?\b|\bfollow!?\b|\bfollowing!?\b|\bhelp!?\b|\bhelping!?\b|\bsupport!?\b/gi.test(text)) return false;

        return /\bthanks!?\b|\bthx!?\b|\bty!?\b/gi.test(text) ? true : false;
    }

    /**
     * Callback for filterRetweetersToThank
     *
     * @callback filterRetweetersToThankCallback
     * @param {array} novel_retweeters_to_thank - The filtered array of users that are eligible to receive "Thank You" tweets
     */

    /**
     * Filters supplied array of retweeters - suppressing those already thanked by bot
     *
     * @param  {array} retweeters_to_thank - Array of users who have recently retweeted bot
     */
    filterRetweetersToThank(retweeters_to_thank, callback) {
        //Get array of already-thanked usernames from mongo
        app.get('thanked_users').find({}, { username: 1, _id: 0 }).toArray(((err, docs) => {
            if (err) {
                app.get('logger').error(err);
                callback(err);
            }

            var thanked_users = [];
            docs.forEach(((doc) => {
                thanked_users.push(doc.username);
            }))

            var novel_retweeters_to_thank = [];
            novel_retweeters_to_thank = retweeters_to_thank.filter(((retweeter) => {
                if (thanked_users.indexOf(retweeter) == -1) return true;
            }))

            callback(null, novel_retweeters_to_thank);
        }))
    }

    /**
     * Accepts an array of tweets returned from search module and filters them for acceptability
     *
     * Using settings.twitter.retweet_disqualifiers for disqualification
     *
     * @param  {Object} tweets - an array of tweets returned by search module
     *
     * @return {Object} validSearchtweets - a filtered array of search tweets
     */
    filterSearchResults(tweets, callback) {
        if (!tweets || typeof tweets === "undefined" || typeof tweets != "object" || !tweets.length || tweets.length < 1) {
            //Callback with empty array
            return callback(null, []);
        }
        var retweetDisqualifiers = app.get('settings').twitter.retweet_disqualifiers;
        var validSearchTweets = [];
        //Loop through tweets received from search - only those that don't contain any disqualifiers are valid
        tweets.forEach((tweet) => {
            if (typeof tweet.text != "undefined" && typeof tweet.text === "string") {
                var tweetValid = false;
                var disqualifications = 0;
                retweetDisqualifiers.forEach((disqualifier) => {
                    if (tweet.text.indexOf(disqualifier) != -1) {
                        disqualifications++;
                    }
                });
                //If the tweet does not contain any retweet_disqualifiers, it is valid for use
                if (disqualifications === 0) {
                    validSearchTweets.push(tweet);
                }
            }
        })
        return callback(null, validSearchTweets);
    }

    /**
     * Safely checks a read-out mongo document content item resource for validity
     *
     * @param  {Object}  doc The mongo record to check for validity
     *
     * @return {Boolean}     Whether or not the mongo document is valid
     */
    isAValidContentDoc(doc) {
        if (
            null === doc || typeof doc.title === "undefined" || typeof doc.origin === "undefined" || typeof doc.original_link === "undefined"
        ) {
            return false;
        }

        return this.isAValidFeedContentItem(doc.title, doc.origin, doc.original_link);
    }
}

module.exports = Manners;