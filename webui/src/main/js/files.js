
class Node {
	constructor(nodeId, parent, leaf, path, size, comment, revision) {
		this.nodeId = nodeId
		this.parent = parent
		this.leaf = leaf
		this.children = []
		this.path = path
		this.size = size
		this.comment = comment
		this.revision = revision
	}
	
	updateDiv() {
		var div = document.getElementById(this.nodeId)
		var unshareLink = "<a href='#' onclick='window.unshare(\"" + this.nodeId +"\");return false;'>Unshare</a>"
		var commentLink = "<span id='comment-link-"+this.nodeId+"'><a href='#' onclick='window.showCommentForm(\"" + this.nodeId + "\");return false;'>Comment</a></span>";
		if (this.leaf) {
			div.innerHTML = "<li>"+this.path+"<br/>"+ unshareLink + "   " + commentLink + "<div id='comment-" + this.nodeId+ "'></div></li>"
		} else {
			if (this.children.length == 0) {
				div.innerHTML = "<li><span><a href='#' onclick='window.expand(\"" + this.nodeId + "\");return false'>" + 
					this.path + "</a>   " + unshareLink + "</span>" + commentLink + "<div id='comment-" + this.nodeId + "'></div></li>"
			} else {
				var l = "<li><a href='#' onclick='window.collapse(\"" + this.nodeId + "\");return false;'>"+this.path+"</a>   " + unshareLink
				l += "  " + commentLink+"<div id='comment-" + this.nodeId + "'></div>"
				
				l += "<ul>"
				var i
				for (i = 0; i < this.children.length; i++) {
					l += "<li>"
					l += "<div id='" + this.children[i].nodeId+"'></div>"
					l += "</li>"
				}
				l += "</ul></li>"
				div.innerHTML = l
			}
		}
	}
}



function refreshStatus() {
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			var xmlDoc = this.responseXML;
			
			var count = xmlDoc.getElementsByTagName("Count")[0].childNodes[0].nodeValue
			var countSpan = document.getElementById("count")
			countSpan.innerHTML = count
			
			var hashingSpan = document.getElementById("hashing")
			var hashing = xmlDoc.getElementsByTagName("Hashing")
			if (hashing != null && hashing.length == 1) {
				hashingSpan.innerHTML = "Hashing "+hashing[0].childNodes[0].nodeValue
			} else
				hashingSpan.innerHTML = "";
				
			var newRevision = xmlDoc.getElementsByTagName("Revision")[0].childNodes[0].nodeValue
			if (newRevision > treeRevision) {
				// TODO: update expanded nodes
				treeRevision = newRevision
			}
		}
	}
	xmlhttp.open("GET", "/MuWire/Files?section=status", true)
	xmlhttp.send();
}

var treeRevision = -1
var root = new Node("root",null,false,"Shared Files", -1, null, -1)
var nodesById = new Map()

function initFiles() {
	setInterval(refreshStatus, 3000)
	setTimeout(refreshStatus, 1)
	
	nodesById.set("root",root)
	root.updateDiv()
}

function encodedPathToRoot(node) {
	var pathElements = []
	var tmpNode = node
	while(tmpNode.parent != null) {
		pathElements.push(Base64.encode(tmpNode.path))
		tmpNode = tmpNode.parent
	}
	var reversedPath = []
	while(pathElements.length > 0)
		reversedPath.push(pathElements.pop())
	var encodedPath = reversedPath.join(",")
	return encodedPath	
}

function expand(nodeId) {
	var node = nodesById.get(nodeId)
	var encodedPath = encodedPathToRoot(node)	
	var xmlhttp = new XMLHttpRequest()
	xmlhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			var xmlDoc = this.responseXML
			var revision = xmlDoc.getElementsByTagName("Revision")[0].childNodes[0].nodeValue
			var fileElements = xmlDoc.getElementsByTagName("File")
			var i
			for (i = 0; i < fileElements.length; i++) {
				var fileName = fileElements[i].getElementsByTagName("Name")[0].childNodes[0].nodeValue
				var size = fileElements[i].getElementsByTagName("Size")[0].childNodes[0].nodeValue
				var comment = fileElements[i].getElementsByTagName("Comment")
				if (comment != null && comment.length == 1)
					comment = comment[0].childNodes[0].nodeValue
				else
					comment = null
				
				var nodeId = node.nodeId + "_"+ Base64.encode(fileName)
				var newFileNode = new Node(nodeId, node, true, fileName, size, comment, revision)
				nodesById.set(nodeId, newFileNode)
				node.children.push(newFileNode)
			}
			
			var dirElements = xmlDoc.getElementsByTagName("Directory")
			for (i = 0; i < dirElements.length; i++) {
				var dirName = dirElements[i].childNodes[0].nodeValue
				var nodeId = node.nodeId + "_"+ Base64.encode(dirName)
				var newDirNode = new Node(nodeId, node, false, dirName, -1, null, revision)
				nodesById.set(nodeId, newDirNode)
				node.children.push(newDirNode)
			}
			
			node.updateDiv()
		    for (i = 0; i < node.children.length; i++) {
				node.children[i].updateDiv()
			}
		}
	}
	xmlhttp.open("GET", "/MuWire/Files?section=fileTree&path="+encodedPath, true)
	xmlhttp.send()
}

function collapse(nodeId) {
	var node = nodesById.get(nodeId)
	node.children = []
	node.updateDiv()
}

function unshare(nodeId) {
	var node = nodesById.get(nodeId)
	var encodedPath = encodedPathToRoot(node)
	var xmlhttp = new XMLHttpRequest()
	xmlhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			var parent = node.parent
			collapse(parent.nodeId)
			expand(parent.nodeId)
		}
	}
	xmlhttp.open("POST", "/MuWire/Files", true)
	xmlhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
	xmlhttp.send("action=unshare&path="+encodedPath)
}

function showCommentForm(nodeId) {
	var linkSpan = document.getElementById("comment-link-"+nodeId)
	linkSpan.innerHTML=""
	var commentDiv = document.getElementById("comment-"+nodeId)
	
	var node = nodesById.get(nodeId)
	var existingComment = node.comment == null ? "" : node.comment
	
	var textArea = "<textarea id='comment-text-" + nodeId + "'>"+existingComment+"</textarea>" 
	var saveCommentLink = "<a href='#' onclick='saveComment(\"" + nodeId + "\");return false;'>Save</a>"
	var cancelCommentLink = "<a href='#' onclick='cancelComment(\"" + nodeId + "\");return false;'>Cancel</a>"
	
	var html = textArea + "<br/>" + saveCommentLink + "  " + cancelCommentLink
	
	commentDiv.innerHTML = html
}

function cancelComment(nodeId) {
	var commentDiv = document.getElementById("comment-"+nodeId)
	commentDiv.innerHTML = ""
	
	var node = nodesById.get(nodeId)
	node.updateDiv()
}

function saveComment(nodeId) {
	var comment = document.getElementById("comment-text-"+nodeId).value
	var node = nodesById.get(nodeId)
	var encodedPath = encodedPathToRoot(node)
	var xmlhttp = new XMLHttpRequest()
	xmlhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			cancelComment(nodeId)
			collapse(node.parent.nodeId)
			expand(node.parent.nodeId) // this can probably be done smarter
		}
	} 
	xmlhttp.open("POST", "/MuWire/Files", true)
	xmlhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
	xmlhttp.send(encodeURI("action=comment&path="+encodedPath+ "&comment="+comment))
}