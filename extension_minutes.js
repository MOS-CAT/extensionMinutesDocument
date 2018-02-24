function main() {
	var doc = getYesterdayDocument();
	var sectionArr = getSectionListBy(doc);
	var sectionList = sectionArr[0];
	var paragraphLists = sectionArr[1];
	
	if (sectionList.length <= 0) {
		deleteYesterdayDocument();
		createTodayDocument();
		return;
	}

	addAllSections(sectionList, paragraphLists);
	createTodayDocument();
}


function createTodayDocument() {
	var now = new Date();
	var dateStr = Utilities.formatDate(now, 'JST', 'yyyy/MM/dd');

	var folderToken = PropertiesService.getScriptProperties().getProperty('FOLDER_ACCESS_TOKEN');
	var minutesFolder = DriveApp.getFolderById(folderToken);

	var newDoc = DocumentApp.create(dateStr);
	var newDocID = newDoc.getId();
	var newFile = DriveApp.getFileById(newDocID);
	minutesFolder.addFile(newFile);
	DriveApp.getRootFolder().removeFile(newFile);
	Logger.log(newDocID) // document ID の確認

	var dbToken = PropertiesService.getScriptProperties().getProperty('DB_ACCESS_TOKEN');
	var dbSS = SpreadsheetApp.openById(dbToken);
	var dateSheet = dbSS.getSheetByName('DATE');
	var lastRow = dateSheet.getLastRow();

	dateSheet.getRange(lastRow+1, 1).setValue(now);
	dateSheet.getRange(lastRow+1, 2).setValue(newDocID);
}


// yesterday の minutes document を取得 -> DocumentApp を返す
function getYesterdayDocument() {
	// dbSS から昨日のDocumentのIDをを取得
	var dbToken = PropertiesService.getScriptProperties().getProperty('DB_ACCESS_TOKEN');
	var dbSS = SpreadsheetApp.openById(dbToken);
	var dateSheet = dbSS.getSheetByName('DATE');
	var lastRow = dateSheet.getLastRow();
	var yesterdayDocID = dateSheet.getRange(lastRow, 2).getValue();

	// document ID から DocumentApp を開く
	var doc = DocumentApp.openById(yesterdayDocID);

	return doc;
}


// yesterday の minutes document を削除
function deleteYesterdayDocument() {
	var dbToken = PropertiesService.getScriptProperties().getProperty('DB_ACCESS_TOKEN');
	var dbSS = SpreadsheetApp.openById(dbToken);
	var dateSheet = dbSS.getSheetByName('DATE');
	var lastRow = dateSheet.getLastRow();
	var yesterdayDocID = dateSheet.getRange(lastRow, 2).getValue();
	var folderToken = PropertiesService.getScriptProperties().getProperty('FOLDER_ACCESS_TOKEN');
	var minutesFolder = DriveApp.getFolderById(folderToken);
	var docFile = DriveApp.getFileById(yesterdayDocID);
	minutesFolder.removeFile(docFile);
	dateSheet.deleteRows(lastRow);
}


// DocumentApp から section ごとのツールを作成して返す
function getSectionListBy(doc) {
	//  doc の paragraphs
	var body = doc.getBody();
	var paragraphs = body.getParagraphs();

	// body を paragraph ごとに分析
	var count = paragraphs.length;
	if (count <= 0) {
		return [[], []];
	}
	var sectionList = [];
	var paragraphLists = [];
	var paragraphList = [];
	for (var i=0; i<count; i++) {
		var heading = paragraphs[i].getHeading();
		var text = paragraphs[i].getText();

		// heading が Title /  Heading 1 / Heading 2 だったらsectionの始まりと認識
		if (heading == 'Title' || heading == 'Heading 1' || heading == 'Heading 2') {
			if (sectionList.length > 0) {
				paragraphLists.push(paragraphList);
				paragraphList = [];
			}

			// tag の認識
			text = text.replace(/\s+/g, '');
			var tags = text.split('/');

			// sectionList に tags を追加
			sectionList.push(tags);
		} else if (sectionList.length > 0) {
			// paragraph を paragraphList に追加
			Logger.log('paragraphs[i]: ' + paragraphs[i].getText());
			paragraphList.push(paragraphs[i]);
		}

		if (i == count-1) {
			paragraphLists.push(paragraphList);
		}
	}

	// sectionList と paragraphList の list を返す
	return [sectionList, paragraphLists];
}


// 全てのsection を全ての type の議事録に追加
function addAllSections(sectionList, paragraphLists) {
	// dbSS の各 sheet の情報の取得
	var dbToken = PropertiesService.getScriptProperties().getProperty('DB_ACCESS_TOKEN');
	var dbSS = SpreadsheetApp.openById(dbToken);
	var categorySheet = dbSS.getSheetByName('CATEGORY');
	var phaseSheet = dbSS.getSheetByName('PHASE');
	var dataSheet = dbSS.getSheetByName('DATA');
	var nameSheet = dbSS.getSheetByName('NAME');

	var categoryLastRow = categorySheet.getLastRow();
	var phaseLastRow = phaseSheet.getLastRow();
	var dataLastRow = dataSheet.getLastRow();
	var nameLastRow = nameSheet.getLastRow();

	var date = new Date();
	date.setDate(date.getDate() - 1);
	var dateStr = Utilities.formatDate(date, 'JST', 'yyyy/MM/dd');

	var count = sectionList.length;
	Logger.log('sectionListのlength: ' + String(sectionList.length));
	Logger.log('paragraphListsのlength: ' + String(paragraphLists.length));
	for (var i=0; i<count; i++) {
		var tags = sectionList[i];
		var categoryID = tags[0];
		var dataID = tags[1];
		var nameID = tags[2];

		var categoryDocID = '';
		var dataDocID = '';

		var categoryDescription = '';
		var dataDescription = '';
		var name = nameID;

		for (var j=1; j<=categoryLastRow; j++) {
			var categoryIDBySheet = categorySheet.getRange(j, 1).getValue();
			if (categoryIDBySheet == categoryID) {
				categoryDocID = categorySheet.getRange(j, 4).getValue();
				categoryDescription = categorySheet.getRange(j, 3).getValue();
				break;
			}
		}

		for (var j=1; j<=dataLastRow; j++) {
			var dataIDBySheet = dataSheet.getRange(j, 1).getValue();
			if (dataIDBySheet == dataID) {
				dataDocID = dataSheet.getRange(j, 4).getValue();
				dataDescription = dataSheet.getRange(j, 2).getValue();
				break;
			}
		}

		for (var j=1; j<=nameLastRow; j++) {
			var nameIDBySheet = nameSheet.getRange(j, 1).getValue();
			if (nameIDBySheet == nameID) {
				name = nameSheet.getRange(j, 2).getValue();
				break;
			}
		}

		if (categoryDocID != '') {
			var doc = DocumentApp.openById(categoryDocID);
			var heading = '日付: ' + dateStr;
			if (dataDescription != '') {
				heading += ', DATA: ' + dataDescription;
			}
			heading += ', 発表者: ' + name;

			addSectionTo(doc, heading, paragraphLists[i]);
		}

		if (dataDocID != '') {
			var doc = DocumentApp.openById(dataDocID);
			var heading = '日付: ' + dateStr;
			if (categoryDescription != '') {
				heading += ', CATEGORY: ' + categoryDescription;
			}
			heading += ', 発表者: ' + name;

			addSectionTo(doc, heading, paragraphLists[i]);
		}
	}
}


// DocumentApp に heading と paragraphList のテキストを作成
function addSectionTo(doc, heading, paragraphList) {
	var body = doc.getBody();
	body.appendParagraph(heading).setHeading(DocumentApp.ParagraphHeading.HEADING2);
	Logger.log('paragraphListのlength: ' + String(paragraphList.length));
	for (var i=0; i<paragraphList.length; i++) {
		Logger.log(paragraphList[i].getText());
		body.appendParagraph(paragraphList[i].getText());
	}
}


function createYesterdayDocument() {
	var now = new Date();
	now.setDate(now.getDate() - 1);
	var dateStr = Utilities.formatDate(now, 'JST', 'yyyy/MM/dd');

	var folderToken = PropertiesService.getScriptProperties().getProperty('FOLDER_ACCESS_TOKEN');
	var minutesFolder = DriveApp.getFolderById(folderToken);

	var newDoc = DocumentApp.create(dateStr);
	var newDocID = newDoc.getId();
	var newFile = DriveApp.getFileById(newDocID);
	minutesFolder.addFile(newFile);
	DriveApp.getRootFolder().removeFile(newFile);
	Logger.log(newDocID) // document ID の確認

	var dbToken = PropertiesService.getScriptProperties().getProperty('DB_ACCESS_TOKEN');
	var dbSS = SpreadsheetApp.openById(dbToken);
	var dateSheet = dbSS.getSheetByName('DATE');
	var lastRow = dateSheet.getLastRow();

	dateSheet.getRange(lastRow+1, 1).setValue(now);
	dateSheet.getRange(lastRow+1, 2).setValue(newDocID);
}