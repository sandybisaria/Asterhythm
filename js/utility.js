function formatParams(params) {
    var paramString = "?";
    for (var key in params) {
        var val = params[key];
        if (val instanceof Array) {
            for (var idx in val) {
                paramString += key + '=' + val[idx] + '&';
            }
        } else {
            paramString += key + '=' + val + '&';
        }
    }

    return paramString.substring(0, paramString.length - 1);
}