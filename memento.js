
/** Searchable on-memory immutable index of tweets. */
class TweetIndex {
    /**
     * 
     * @param {Array<Object>} tweets Objects from tweet.json in newest-first order.
     */
    constructor(account, tweets) {
        this.account = account;
        this.tweets = tweets;

        this.tweets.forEach(tweet => {
            tweet.full_text = tweet.full_text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
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

            const date = new Date(tweet.created_at);
            return {
                id: tweet.id_str,
                text: tweet.full_text,
                localYear: date.getFullYear(),
                localDate: date.toLocaleDateString(),
                url: "https://twitter.com/" + this.account.username + "/status/" + tweet.id_str,
                json: JSON.stringify(tweet, " ", 2),
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
            return Promise.all([zip.file("account.js").async("string"), zip.file("tweet.js").async("string")]);
        })
        .then(([accountJson, tweetJson]) => {
            const account = parseBrokenJsonFromDump(accountJson);
            const tweets = parseBrokenJsonFromDump(tweetJson);
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
    var app = new Vue({
        el: '#app',
        data: {
            indexLoaded: false,
            searchQuery: "",
            expandedTweetId: null,
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
            searchResults: function () {
                return this.filteredTweets.slice(0, 1000); // DOM performance optimization
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
