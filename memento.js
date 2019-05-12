
/** Searchable on-memory immutable index of tweets. */
class TweetIndex {
    /**
     * 
     * @param {Array<Object>} tweets Objects from tweet.json in newest-first order.
     */
    constructor(tweets) {
        this.tweets = tweets;
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
            return {
                text: tweet.full_text,
                localYear: new Date(tweet.created_at).getFullYear(),
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
        .then(zip => zip.file("tweet.js").async("string"))
        .then(tweetJson => {
            tweetJson = tweetJson.replace("window.YTD.tweet.part0 =", "");
            const tweets = JSON.parse(tweetJson);
            tweets.sort((a, b) => {
                return new Date(b.created_at) - new Date(a.created_at);
            });  // newest first
            return new TweetIndex(tweets);
        });
}

function main() {
    Vue.use(SemanticUIVue);

    const maybeIndex = { index: null };
    var app = new Vue({
        el: '#app',
        data: {
            indexLoaded: false,
            searchQuery: "",
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
