import { htmlDecode } from "./util.js";

// P1: "like" id -> time guesser
// https://developer.twitter.com/en/docs/basics/twitter-ids.html
/**
 * Searchable on-memory immutable index of tweets.
 * 
 * TimedEntity
 *  - tweet (own) 
 *  - TBD: like (someone else): ambiguous timestamp / no user (text only)
 *  - TBD: DM (self / other), with proper timestamp (sender Id only)
 *
 * Non-timed entity
 *  - follow (id only) / follower (id only) / block / mute
 */
class TweetIndex {
    /**
     * 
     * @param {Array<Object>} tweets Objects from tweet.json in newest-first order.
     */
    constructor(account, tweets) {
        this.account = account;
        this.tweets = tweets;

        this.tweets.forEach(tweet => {
            tweet.full_text = htmlDecode(tweet.tweet.full_text);
        });
        console.log("Sample", this.tweets.slice(0, 10));
    }

    /**
     * O(1)
     */
    getCount() {
        return this.tweets.length;
    }

    search(query) {
        return this.tweets.filter(tweet => {
            if (query.length === 0) {
                return true;
            }
            return tweet.full_text.indexOf(query) >= 0;
        }).map(tweet => {
            const date = new Date(tweet.tweet.created_at);
            return {
                id: tweet.tweet.id_str,
                text: tweet.tweet.full_text,
                localYear: date.getFullYear(),
                localDate: date.toLocaleDateString(),
                url: "https://twitter.com/i/web/status/" + tweet.tweet.id_str,
                json: JSON.stringify(tweet, " ", 2),
                media: ((tweet.tweet.extended_entities && tweet.tweet.extended_entities.media) || []).map(m => m.media_url_https),
            };
        });
    }
}

/**
 * 
 * @param {ArrayBuffer|File} stream twitter .zip expoted data
 * @return {Promise<TweetIndex>}
 */
function createTweetIndexFromTwitterDump(stream) {
    return JSZip.loadAsync(stream)
        .then(zip => {
            console.log("Zip files", zip.files);
            return Promise.all(["data/account.js", "data/tweet.js", "data/direct-messages.js"].map(fileName => zip.file(fileName).async("string")));
        })
        .then(([accountJson, tweetJson, likeJson]) => {
            const account = parseBrokenJsonFromDump(accountJson);
            const tweets = parseBrokenJsonFromDump(tweetJson);
            const likes = parseBrokenJsonFromDump(likeJson);
            console.log(likes);
            tweets.sort((a, b) => {
                return new Date(b.created_at) - new Date(a.created_at);
            });  // newest first
            return new TweetIndex(account, tweets);
        });
}

function parseBrokenJsonFromDump(jsonString) {
    // e.g. "window.YTD.tweet.part0 = <proper JSON>"
    const separator = " = ";
    const varSubstIndex = jsonString.indexOf(separator);
    return JSON.parse(varSubstIndex < 0 ? jsonString : jsonString.substr(varSubstIndex + separator.length));
}

function main() {

    Vue.use(SemanticUIVue);

    const maybeIndex = { index: null };
    const MAX_NUM_RESULTS = 500;
    var app = new Vue({
        el: '#app',
        data: {
            indexLoaded: false,
            searchQuery: "",
            expandedTweetId: null,
            focusYear: null,
        },
        methods: {
            onFileChange: function (event) {
                this.loadTwitterZipStream(event.srcElement.files[0]);
            },
            loadTwitterZipStream: function (stream) {
                createTweetIndexFromTwitterDump(stream).then(index => {
                    maybeIndex.index = index;
                    this.indexLoaded = true;
                });
            },
            showRaw: function (tweetId) {
                this.expandedTweetId = tweetId;
            },
            gotoYear: function (localYear) {
                this.focusYear = localYear;
                this.$nextTick(() => {
                    // Need to wait until DOM gets updated by focusYear change.
                    window.location.hash = 'section_' + localYear;
                });
            },
        },
        computed: {
            numTotal: function () {
                if (!this.indexLoaded) {
                    return 0;
                }
                return maybeIndex.index.getCount();
            },
            filteredTweets: function () {
                if (!this.indexLoaded) {
                    return [];
                }
                return maybeIndex.index.search(this.searchQuery);
            },
            // Truncate results around focusYear to optimize DOM rendering.
            _beginIndex: function () {
                if (this.filteredTweets.length <= MAX_NUM_RESULTS) {
                    return 0;
                }
                const beginYear = (this.focusYear ? this.focusYear : new Date().getFullYear());
                // Read a little bit of newer content for apparence of infinite scrolling.
                // searchResult composition;
                // * 1/4 of content of focusYear + 1
                // * <last day of focusYear>
                // * 3/4 of content of focusYear
                return Math.max(0, this.filteredTweets.findIndex(tw => tw.localYear === beginYear) - Math.floor(MAX_NUM_RESULTS / 4));
            },
            // exclusive
            _endIndex: function () {
                return Math.min(this.filteredTweets.length, this._beginIndex + MAX_NUM_RESULTS);
            },
            searchResults: function () {
                return this.filteredTweets.slice(this._beginIndex, this._endIndex);
            },
            numTruncatedPre: function () {
                return this._beginIndex;
            },
            numTruncatedPost: function () {
                return this.filteredTweets.length - this._endIndex;
            },
            years: function () {
                const years = new Map();
                this.filteredTweets.forEach(tweet => {
                    const year = tweet.localYear;
                    if (years.has(year)) {
                        years.set(year, years.get(year) + 1);
                    } else {
                        years.set(year, 1);
                    }
                });

                const menuYears = new Array(...years.entries());
                menuYears.sort((a, b) => {
                    return b[0] - a[0];
                }); // newest first
                return menuYears.map(e => {
                    return {
                        text: e[0],
                        numHits: e[1],
                    };
                });
            },
        },
    });


    // Dev options for quicker iterations.
    const autoload = new URL(window.location.href).searchParams.get("autoload");
    if (autoload) {
        window.fetch(autoload).then(response => response.arrayBuffer()).then(data => {
            app.loadTwitterZipStream(data);
        });
    }
}

main();
