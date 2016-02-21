jQuery.ajaxSettings.traditional = true; // For proper param serialization

var echonestBaseUrl = "http://developer.echonest.com/";
var echonestApiKey = "I6TZLAVYDEBYBNJIE";

var spotifyBaseUrl = "https://api.spotify.com/"

var chartlyricsBaseUrl = "http://api.chartlyrics.com/apiv1.asmx/"

var sessionId = "";
var bucketVals = ["id:spotify", "tracks"]; // Used in many Echo Nest requests

var remixerContext = null;

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
    $("#song-content").hide();
    $("#search-bar").submit(function() {
        createPlaylist();
        return false;
    })
});

function createPlaylist() {
    var query = $("#query").val();
    var pref = $("input[name=pref]:checked").val();

    if (query === "") {
        // alert("Please search for something");
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
        .done(function (data, textStatus, jqXHR) {
            onGetSpotifyTrack(data, textStatus, jqXHR, nextSong)
        })
        .fail(onGetSpotifyTrackError);
}

function onGetNextSongError(jqXHR, textStatus, errorThrown) {
    console.log(jqXHR);
    console.log(textStatus);
    console.log(errorThrown);
}

function onGetSpotifyTrack(data, textStatus, jqXHR, echonestTrack) {
    var previewUrl = data.preview_url;
    if (previewUrl === undefined || previewUrl == null) {
        getNextSong(); // For now, skip songs without
        return;
    }

    // Load the track into the remixer
    if (remixerContext === null) {
        remixerContext= new AudioContext();
    }
    var remixer = createJRemixer(remixerContext, $, echonestApiKey);
    var player = remixer.getPlayer();
    remixer.remixTrackById(echonestTrack.id, previewUrl, function(track, percent) {
        remixSong(track, percent, player, previewUrl);
    });

    // Load the lyrics from ChartLyrics
    var getChartlyricsTrackUrl = chartlyricsBaseUrl + "SearchLyricDirect";
    var artist = data.artists[0].name;
    var title = data.name;

    $("#song-artist").html(artist);
    $("#song-title").html(title);

    adjustUI()

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

function adjustUI() {
    // Hide searching UI; made it this far so no need to search...
    $("#search-content").hide();
    $("#song-content").show();
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

function remixSong(track, percent, player, songUrl) {
    if (track.status === "ok") {
        var gainCounter = 0;
        var gainArray = new Array();

        var remixed = new Array();
        var beatCount = track.analysis.beats.length
        for (var i=0; i < beatCount; i++) {
            beat = track.analysis.beats[i]
            if (i/beatCount < 0.1) {
                gainArray.push(10*i/beatCount)
            } else if ((10-i)/beatCount > 0.9) {
                gainArray.push(10*(10-i)/beatCount)
            } else {
                gainArray.push(1)
            }
            remixed.push(beat)
        }

        // player.play(0, remixed);

        var playerBase = $("#songstreamer")
        var player = playerBase[0]
        player.src = songUrl;
        player.volume = 0;
        player.play();

        var fadeInId = null;
        player.ondurationchange = function() {
            var duration = player.duration;
            if (duration === NaN) {
                return;
            }

            var fadeTime = (duration/10) * 1000 //ms

            playerBase.animate({
                "volume" : 1
            }, fadeTime)

            var triggerFadeOutTime = (8.5*duration/10) * 1000 //ms
            fadeInId = setTimeout(function() {
                playerBase.animate({
                    "volume" : 0
                }, fadeTime)
            }, triggerFadeOutTime)
        }
        player.onended = function() {
            if (fadeInId !== null) {
                clearTimeout(fadeInId); // Clear the timeout (just to be sure...)
            }
            getNextSong();
        }
    }
}
