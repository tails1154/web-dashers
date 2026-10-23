window.ApiWrapper = class ApiWrapper {
	static proxyurl = "/cgi-bin/gd/server.py"
	static setProxy(string) {
		this.proxyurl = string
	}
	static getProxy() {
		return this.proxyurl;
	}
	static async downloadSong(id) {
		return null;
	}
    static async downloadSfx(id){
		return null;
    }
	static async downloadLevel(id) {
		const PROXY_BASE = (window._gdProxyUrl || "").replace(/\/$/, "") || this.proxyurl;
		const res = await fetch(`${PROXY_BASE}?action=get&id=${id}`);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const data = await res.json();
		if (!data || data.error || !data.level_string) throw new Error(data.error || "no level data");
		return new LevelObject(
			data.id, data.name || "Level " + data.id, "", data.level_string,
			"1", "0", "0", "0", "0", "0", "0", "22", "0", "0",
			false, "0", "0", false, "", "", "", "", "", false,
			null, "", "0", false, "0", false, "0", "0", "0",
			false, "0", "0", false, "0", [], [], "0", ""
		);
	}
}


class LevelObject {
	constructor(levelID, levelName, description, levelString, version, playerID, difficultyDenominator, difficultyNumerator, downloads, setCompletes, officialSong, gameVersion, likes, levelLength, dislikes, demon, stars, featureScore, auto, recordString, password, uploadDate, updateDate, copiedID, twoPlayer, customSongID, extraString, coins, verifiedCoins, starsRequested, lowDetailMode, dailyNumber, epic, demonDifficulty, isGauntlet, objects, editorTime, editorTimeCopies, settingsString, songIDs, sfxIDs, songSize, verificationTime) {
		this.levelID = levelID;
		this.levelName = levelName;
		this.description = description;
		this.levelString = levelString;
		this.version = version;
		this.playerID = playerID;
		this.difficultyDenominator = difficultyDenominator;
		this.difficultyNumerator = difficultyNumerator;
		this.downloads = downloads;
		this.setCompletes = setCompletes;
		this.officialSong = officialSong;
		this.gameVersion = gameVersion;
		this.likes = likes;
		this.levelLength = levelLength;
		this.dislikes = dislikes;
		this.demon = demon;
		this.stars = stars;
		this.featureScore = featureScore;
		this.auto = auto;
		this.recordString = recordString;
		this.password = password;
		this.uploadDate = uploadDate;
		this.updateDate = updateDate;
		this.copiedID = copiedID;
		this.twoPlayer = twoPlayer;
		this.customSongID = customSongID;
		this.extraString = extraString;
		this.coins = coins;
		this.verifiedCoins = verifiedCoins;
		this.starsRequested = starsRequested;
		this.lowDetailMode = lowDetailMode;
		this.dailyNumber = dailyNumber;
		this.epic = epic;
		this.demonDifficulty = demonDifficulty;
		this.isGauntlet = isGauntlet;
		this.objects = objects;
		this.editorTime = editorTime;
		this.editorTimeCopies = editorTimeCopies;
		this.settingsString = settingsString;
		this.songIDs = songIDs;
		this.sfxIDs = sfxIDs;
		this.songSize = songSize;
		this.verificationTime = verificationTime;
	}
}
