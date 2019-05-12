
function main() {
    Vue.use(SemanticUIVue);

    var app = new Vue({
        el: '#app',
        data: {
            tweets: [],
            searchQuery: "",
        },
        methods: {
            onFileChange: function (event) {
                this.loadTwitterZipStream(event.srcElement.files[0]);
            },
            loadTwitterZipStream: function (stream) {
                JSZip.loadAsync(stream).then(zip => {
                    zip.file("tweet.js").async("string").then(tweetJson => {
                        tweetJson = tweetJson.replace("window.YTD.tweet.part0 =", "");
                        const tweets = JSON.parse(tweetJson);
                        tweets.sort((a, b) => {
                            return new Date(b.created_at) - new Date(a.created_at);
                        });  // newest first
                        this.tweets = tweets;
                    });
                });
            },
        },
        computed: {
            searchResults: function () {
                console.log(this.tweets[0]);
                return this.tweets.filter(tweet => {
                    if (this.searchQuery.length === 0) {
                        return true;
                    }
                    return tweet.full_text.indexOf(this.searchQuery) >= 0;
                }).map(tweet => {
                    return {
                        text: tweet.full_text
                    };
                });

            },
            years: function () {
                const years = new Map(); // local year
                this.tweets.filter(tweet => {
                    if (this.searchQuery.length === 0) {
                        return true;
                    }
                    return tweet.full_text.indexOf(this.searchQuery) >= 0;
                }).forEach(tweet => {
                    const year = new Date(tweet.created_at).getFullYear();
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
