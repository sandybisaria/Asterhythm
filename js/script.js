jQuery.ajaxSettings.traditional = true; // For proper param serialization

var echonestBaseUrl = "http://developer.echonest.com/";
var echonestApiKey = "I6TZLAVYDEBYBNJIE";

var spotifyBaseUrl = "https://api.spotify.com/"

var chartlyricsBaseUrl = "http://api.chartlyrics.com/apiv1.asmx/"

var sessionId = "";
var bucketVals = ["id:spotify", "tracks"]; // Used in many Echo Nest requests

var clearSession = function() {
    var deleteUrl = echonestBaseUrl + "api/v4/playlist/dynamic/delete";
    var deleteParams = {
        "api_key" : echonestApiKey,
        "session_id" : sessionId
    };

    $.getJSON(deleteUrl, deleteParams);
}

window.onbeforeunload = function() {
    if (sessionId != "") {
        clearSession(); // Delete the session (for now)
    }
}

$(document).ready(function () {
    $("#query-btn").on("click", createPlaylist);
});

function createPlaylist() {
    var query = $("#query").val();
    var pref = $("input[name=pref]:checked").val();

    if (query === "") {
        alert("Please search for something");
        return;
    }

    var createPlaylistUrl = echonestBaseUrl + "api/v4/playlist/dynamic/create";
    var createPlaylistParams = {
        "api_key" : echonestApiKey,
        "bucket" : bucketVals,
        "limit" : true
    }

    switch (pref) {
        case "genre": {
            createPlaylistParams.type = "genre-radio";
            createPlaylistParams.genre = query;

            $.ajax({
                "cache" : false, // Necessary so the browser doesn't return old responses
                "data" : createPlaylistParams,
                "dataType" : "json",
                "url" : createPlaylistUrl
            })
                .done(onCreatePlaylist)
                .fail(onCreatePlaylistError);
            break;
        }

        case "artist": {
            createPlaylistParams.type = "artist-radio";
            createPlaylistParams.artist = query;

            $.ajax({
                "cache" : false,
                "data" : createPlaylistParams,
                "dataType" : "json",
                "url" : createPlaylistUrl
            })
                .done(onCreatePlaylist)
                .fail(onCreatePlaylistError);
            break;
        }

        case "song": {
            createPlaylistParams.type = "song-radio";

            var songSearchUrl = echonestBaseUrl + "api/v4/song/search";
            var songSearchParams = {
                "api_key" : echonestApiKey,
                "bucket" : bucketVals,
                "limit" : true,
                "combined" : query, // In case someone says a song with its artist
                "results" : 1 // Just try the first one
            };
            $.ajax({
                "cache" : false,
                "data" : songSearchParams,
                "dataType" : "json",
                "url" : songSearchUrl
            })
                .done(function(data) {
                    var response = data.response;
                    
                    var songs = response.songs;
                    if (songs.length === 0) {
                        onInvalidQuery();
                        return;
                    }

                    createPlaylistParams.song_id = songs[0].id;
                    $.ajax({
                        "cache" : false,
                        "data" : createPlaylistParams,
                        "dataType" : "json",
                        "url" : createPlaylistUrl
                    })
                        .done(onCreatePlaylist)
                        .fail(onCreatePlaylistError);
                })
                .fail(onCreatePlaylistError);
            break;
        }
    }
}

function onCreatePlaylist(data, textStatus, jqXHR) {
    var response = data.response;

    sessionId = response.session_id;
    
    getNextSong();
}

function onCreatePlaylistError(jqXHR, textStatus, errorThrown) {
    var status = jqXHR.responseJSON.response.status;
    switch (status.code) {
        case 5: {
            onInvalidQuery();
        }
    }
}

function onInvalidQuery() {
    alert("Looks like your query was invalid");
}

function getNextSong() {
    var nextUrl = echonestBaseUrl + "api/v4/playlist/dynamic/next";
    var nextParams = {
        "api_key" : echonestApiKey,
        "session_id" : sessionId
    }

    $.ajax({
        "cache" : false,
        "data" : nextParams,
        "dataType" : "json",
        "url" : nextUrl
    })
        .done(onGetNextSong)
        .fail(onGetNextSongError)
}

function foreignToSpotifyId(foreignId) {
    var fields = foreignId.split(':');
    return fields[fields.length - 1];
}

function onGetNextSong(data, textStatus, jqXHR) {
    var response = data.response;

    var songs = response.songs;
    var nextSong = songs[0];
    // console.log(nextSong);
    
    // Get the song from Spotify?..
    var spotifyId = foreignToSpotifyId(nextSong.tracks[0].foreign_id);
    var getSpotifyTrackUrl = spotifyBaseUrl + "v1/tracks/" + spotifyId.toString();
    $.ajax({
        "cache" : false,
        "url" : getSpotifyTrackUrl
    })
        .done(onGetSpotifyTrack)
        .fail(onGetSpotifyTrackError);
}

function onGetNextSongError(jqXHR, textStatus, errorThrown) {
    console.log(jqXHR);
    console.log(textStatus);
    console.log(errorThrown);
}

function onGetSpotifyTrack(data, textStatus, jqXHR) {
    var previewUrl = data.preview_url;
    if (previewUrl === undefined || previewUrl == null) {
        getNextSong(); // For now, skip songs without
        return;
    }

    // console.log(previewUrl);
    // console.log(data);

    var player = new Audio(previewUrl);
    player.play();
    player.onended = function() {
        getNextSong();
    }

    // Load the lyrics from ChartLyrics
    var getChartlyricsTrackUrl = chartlyricsBaseUrl + "SearchLyricDirect";
    var artist = data.artists[0].name;
    var title = data.name;

    $("#songartist").html(artist);
    $("#songtitle").html(title);

    // Hide searching UI; made it this far so no need to search...
    $("#searchcontent").hide();

    var getChartlyricsTrackParams = {
        "artist" : artist,
        "song" : title,
    }
    $.ajax({
        "cache" : false,
        "data" : getChartlyricsTrackParams,
        "dataType" : "xml",
        "url" : getChartlyricsTrackUrl
    })
        .done(onGetLyrics)
        .fail(onGetLyricsError);
}

function onGetSpotifyTrackError(jqXHR, textStatus, errorThrown) {
    console.log(jqXHR);
    console.log(textStatus);
    console.log(errorThrown);
}

function onGetLyrics(data, textStatus, jqXHR) {
    var jsonData = JXON.build(data);
    var lyrics = jsonData.getlyricresult.lyric;

    if (typeof lyrics === "string") {
        $("#lyrics").html(lyrics.split("\n").join("<br/>"));
    } else {
        $("#lyrics").html("");
    }
}

function onGetLyricsError(jqXHR, textStatus, errorThrown) {
    console.log(jqXHR);
    console.log(textStatus);
    console.log(errorThrown);
}
