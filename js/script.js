var echonestBaseUrl = "http://developer.echonest.com/"
var echonestApiKey = "I6TZLAVYDEBYBNJIE"
var bucketVals = ["id:spotify", "tracks"] // Used in many Echo Nest requests

var spotifyBaseUrl = "https://api.spotify.com/"

var chartlyricsBaseUrl = "http://api.chartlyrics.com/apiv1.asmx/"

var sessionId = "" // The `user's current session ID

window.onbeforeunload = function() {
    if (sessionId !== "") {
        // Delete the session from Echo Nest (so we don't exceed the limit)

        var deleteUrl = echonestBaseUrl + "api/v4/playlist/dynamic/delete"
        var deleteParams = {
            "api_key" : echonestApiKey,
            "session_id" : sessionId,
            "_" : Math.random() // Necessary to prevent browser caching (of repeated queries)
        }
        deleteUrl += formatParams(deleteParams)

        var deleteRequest = new XMLHttpRequest()
        deleteRequest.open("GET", deleteUrl, true)
        deleteRequest.onreadystatechange = function() {
            if (deleteRequest.readyState === 4) {
                console.log("successfully logged out")
            }
        }
        deleteRequest.send()
    }
}

window.onload = function() {
    document.getElementById("search-bar").onsubmit = function() {
        createPlaylist()
        return false
    }
}

function createPlaylist() {
    var query = document.getElementById("search-bar-query").value
    var filter = document.getElementById("search-bar-type-select").value

    var createPlaylistUrl = echonestBaseUrl + "api/v4/playlist/dynamic/create"
    var createPlaylistParams = {
        "api_key" : echonestApiKey,
        "bucket" : bucketVals,
        "limit" : true,
        "_" : Math.random() // Necessary to prevent browser caching (of repeated queries)
    }

    if (filter === "song") {
        createPlaylistParams.type = "song-radio";

        // Must look up the song's actual title
        var songSearchUrl = echonestBaseUrl + "api/v4/song/search"
        var songSearchParams = {
            "api_key" : echonestApiKey,
            "bucket" : bucketVals,
            "limit" : true,
            "combined" : query, // "Combined" in case someone says a song with its artist
            "results" : 1 // Just use the first one for now (may get more songs)
        }

        songSearchUrl += formatParams(songSearchParams)
        var songSearchReq = new XMLHttpRequest()
        songSearchReq.open("GET", songSearchUrl, true)
        songSearchReq.responseType = "json"
        songSearchReq.onreadystatechange = function() {
            if (songSearchReq.readyState == 4) {
                if (songSearchReq.status == 200) {
                    var res = songSearchReq.response.response
                    var songs = res.songs;
                    if (songs.length > 0) {
                        createPlaylistParams.song_id = songs[0].id
                        createPlaylistUrl += formatParams(createPlaylistParams)

                        makeCreatePlaylistRequest(createPlaylistUrl)
                    } else {
                        // May want to change to a function
                        alert("Sorry, no songs could be found")
                    }

                } else {
                    // May want to change to reflect a failed song search
                    onCreatePlaylistError(songSearchReq)
                }
            }
        }
        songSearchReq.send()

    } else {
        if (filter === "genre") {
            createPlaylistParams.type = "genre-radio";
            createPlaylistParams.genre = query;
        } else if (filter === "artist") {
            createPlaylistParams.type = "artist-radio";
            createPlaylistParams.artist = query;
        }

        createPlaylistUrl += formatParams(createPlaylistParams)
        makeCreatePlaylistRequest(createPlaylistUrl)
    }
}

function makeCreatePlaylistRequest(createPlaylistUrl) {
    var createPlaylistRequest = new XMLHttpRequest()
    console.log(createPlaylistUrl)
    createPlaylistRequest.open("GET", createPlaylistUrl, true)
    createPlaylistRequest.responseType = "json"
    createPlaylistRequest.onreadystatechange = function() {
        if (createPlaylistRequest.readyState === 4) {
            if (createPlaylistRequest.status === 200) {
                onCreatePlaylistSuccess(createPlaylistRequest)
            } else {
                onCreatePlaylistError(createPlaylistRequest)
            }
        }
    }
    createPlaylistRequest.send()
}

function onCreatePlaylistError(req) {
    alert("Error " + req.status + ': ' + req.statusText)
}

function onCreatePlaylistSuccess(req) {
    var res = req.response.response
    sessionId = res.session_id
    console.log(sessionId)
    getNextSong()
}

function getNextSong() {
    var nextUrl = echonestBaseUrl + "api/v4/playlist/dynamic/next"
    var nextParams = {
        "api_key" : echonestApiKey,
        "session_id" : sessionId,
        "_" : Math.random() // Necessary to prevent browser caching (of repeated queries)
    }
    nextUrl += formatParams(nextParams)

    var nextReq = new XMLHttpRequest()
    nextReq.open("GET", nextUrl, true)
    nextReq.responseType = "json"
    nextReq.onreadystatechange = function() {
        if (nextReq.readyState === 4) {
            if (nextReq.status === 200) {
                onGetNextSongSuccess(nextReq)
            } else {
                onGetNextSongError(nextReq)
            }
        }
    }
    nextReq.send()
}

function onGetNextSongError(req) {
    onCreatePlaylistError(req) // For now...
}

function foreignToSpotifyId(foreignId) {
    // The foreign ID is of format "spotify:track:foreign_id" and we only need the last part

    var fields = foreignId.split(':');
    if (fields[0] == "spotify") {
        return fields[fields.length - 1];
    }
    
    return ""
}

function onGetNextSongSuccess(req) {
    var res = req.response.response

    var songs = res.songs
    var nextSong = songs[0]

    var spotifyId = foreignToSpotifyId(nextSong.tracks[0].foreign_id)
    if (spotifyId != "") {
        var getTrackUrl = spotifyBaseUrl + "v1/tracks/" + spotifyId
        console.log(getTrackUrl)
        var getTrackReq = new XMLHttpRequest()
        getTrackReq.open("GET", getTrackUrl, true)
        getTrackReq.responseType = "json"
        getTrackReq.onreadystatechange = function() {
            if (getTrackReq.readyState == 4) {
                if (getTrackReq.status == 200) {
                    onGetSpotifyTrackSuccess(getTrackReq)
                } else {
                    onGetSpotifyTrackError(getTrackReq)
                }
            }
        }
        getTrackReq.send()
    }
}

function onGetSpotifyTrackError(req) {
    onCreatePlaylistError(req) // For now...
}

function hideSearchContainer(onHideFn) {
    searchContainer = document.getElementById("search-container")
    var oldClass = searchContainer.className
    searchContainer.className += " animated fadeOutUp"
    var onAnimationEnd = function() {
        searchContainer.className = oldClass
        searchContainer.style.display = "none"
        searchContainer.removeEventListener("animationend", onAnimationEnd)

        onHideFn()
    }
    searchContainer.addEventListener("animationend", onAnimationEnd)
}

function showPlayContainer() {
    playContainer = document.getElementById("play-container")
    var oldClass = playContainer.className
    playContainer.className += " animated fadeInDown"
    playContainer.style.display = null
    var onAnimationEnd = function() {
        playContainer.className = oldClass
        playContainer.removeEventListener("animationend", onAnimationEnd)
    }
    playContainer.addEventListener("animationend", onAnimationEnd)

    //TODO Design a nice player that goes well with the website
}

function onGetSpotifyTrackSuccess(req) {
    var res = req.response
    var previewUrl = res.preview_url

    if (previewUrl !== undefined && previewUrl !== null) {
        hideSearchContainer(showPlayContainer)
        playSong(previewUrl)

        var artist = res.artists[0].name;
        var title = res.name;

        document.getElementById("song-info").innerHTML = "Now playing " + title + " by " + artist
    } else {
        getNextSong()
    }
}

function playSong(url) {
    var player = document.getElementById("song-streamer")
    player.src = url
    player.onended = function() {
        getNextSong()
    }
    player.play()
}