# how to setup virtualenv and flask
# 0. http://net.tutsplus.com/tutorials/python-tutorials/an-introduction-to-pythons-flask-framework/

# how to run routes.py
# 1. cd ~/Desktop/uber/flaskapp2
# 2. . bin/activate
# 3. python routes.py

# how to setup SQLAlchemy - good ref # http://docs.sqlalchemy.org/en/rel_0_8/core/engines.html
# 0. http://mapfish.org/doc/tutorials/sqlalchemy.html
# 1. cd ~/Desktop/uber/flaskapp2
# 2. . bin/activate
# 3. sudo pip install SQLAlchemy

# how to install git on amazon ec2
# sudo yum install git

import sqlite3
from flask import Flask, render_template, request, jsonify, g
app = Flask(__name__)

@app.route("/")
def index(name=None):
	return render_template("index.html")

@app.route("/createdb/", methods=["POST","GET"])
def createdb():
	connection = sqlite3.connect("foo.db")
	cursor = connection.cursor()
	connection.execute(
		"""
		CREATE TABLE addresses (
			id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			lat FLOAT NOT NULL,
			lng FLOAT NOT NULL,
			address VARCHAR NOT NULL,
			nickname VARCHAR NOT NULL
		);
		"""
	)
	connection.commit()
	cursor.close()
	connection.close()
	return '{"result":"success"}';

@app.route("/truncatedb/", methods=["POST","GET"])
def truncatedb():
	connection = sqlite3.connect("foo.db")
	cursor = connection.cursor()
	connection.execute("DELETE FROM addresses")
	connection.commit()
	connection.close()
	return '{"result":"success"}';

@app.route("/insertdb/", methods=["POST"])
def insertdb():
	params = request.form
	if set(("lat", "lng","address","nickname")).issubset(params):
		connection = sqlite3.connect("foo.db")
		cursor = connection.cursor()
		result = cursor.execute("INSERT INTO addresses (lat, lng, address, nickname) VALUES (?, ?, ?, ?)", (params["lat"], params["lng"], params["address"], params["nickname"]))
		connection.commit()
		connection.close()

		if cursor.lastrowid:
			return '{"id":"'+str(cursor.lastrowid)+'"}'
		else:
			return '{"id":"'+"-1"+'"}'

	return '{"result":"error"}'

@app.route("/selectdb/", methods=["POST","GET"])
def selectdb():
	connection = sqlite3.connect("foo.db")
	connection.row_factory = sqlite3.Row #access the retrieved columns by name
	cursor = connection.cursor()
	result = cursor.execute('SELECT * FROM addresses')
	addressList = []

	json_data = '{ "addresses":['
	for row in result:
		addressList.append('{"id":"'+str(row["id"])+'","nickname":"'+str(row["nickname"])+'","address":"'+str(row["address"])+'","lat":"'+str(row["lat"])+'","lng":"'+str(row["lng"])+'"}')
	json_data += ', '.join(addressList) + ']}'
	
	cursor.close()
	connection.close()
	return json_data

@app.route("/updatedb/", methods=["POST"])
def updatedb():
	connection = sqlite3.connect("foo.db")
	cursor = connection.cursor()
	params = request.form

	if set(("id","lat", "lng","address")).issubset(params):
		result = cursor.execute("UPDATE addresses SET address=?, lat=?, lng=? WHERE id=?", [params["address"],params["lat"],params["lng"],params["id"]] ) #WHERE tutorial_id=3;
		connection.commit()
	if set(("id", "nickname")).issubset(params):
		result = cursor.execute("UPDATE addresses SET nickname=? WHERE id=? ", [params["nickname"],params["id"]] ) #WHERE tutorial_id=3;
		connection.commit()
	cursor.close()
	connection.close()
	return '{"result":"success"}'

@app.route("/deletedb/", methods=["POST"])
def deletedb():
	connection = sqlite3.connect("foo.db")
	cursor = connection.cursor()
	params = request.form

	if params["id"]:
		result = cursor.execute("DELETE FROM addresses WHERE id=?", [params["id"]] ) #WHERE tutorial_id=3;
		connection.commit()
	cursor.close()
	connection.close()
	return '{"result":"success"}'

if __name__ == "__main__":
	app.run(port=5000, debug=True)








