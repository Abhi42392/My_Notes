import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";

const app=express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

//Establishing connection between database and server
const db=new pg.Client({
    user: process.env.DB_USER,         
  host: process.env.DB_HOST,        
  password: process.env.DB_PASSWORD, 
  database: process.env.DB_NAME,     
  port: process.env.DB_PORT || 5432
});

db.connect()
  .then(() => console.log('Connected to the database'))
  .catch(err => console.error('Connection error', err.stack));


var notes=[];

async function getNotes(){
    try{
        const result=await db.query("SELECT * FROM book");
        notes=result.rows;
    }catch(err){
        console.log(err);
    }
}
app.get("/",async (req,res)=>{
    await getNotes();
    res.render("index.ejs",{noteItems:notes});
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});

app.get("/notes",async (req,res)=>{
    const id=req.query.id;
    const result=await getData(id);
    res.render("notes.ejs",{item:result[0]});
});

async function getData(id) {
    const response = await db.query(
        `SELECT * FROM book JOIN notes ON book.id = notes.book_id WHERE book.id = $1`, 
        [id]
    );
    return response.rows;
}

app.get("/new",(req,res)=>{
    res.render("newBook.ejs");
});

app.post("/add",async(req,res)=>{
    console.log(req.body);

    var title=req.body.title;
    var author=req.body.author;
    const date=req.body.date;
    const rating=req.body.rating;
    const summary=req.body.summary;
    var bookId=0;
    var query=title+" "+author;
    const url=createUrl(query);
    const coverId=await getCoverId(url);

    try{
        await db.query("INSERT INTO book(title,author,date_read,rating,cover_id) VALUES($1,$2,$3,$4,$5)",[title,author,date,rating,coverId]);
    }catch(err){
        console.log(err);
    }
    const result=await db.query("SELECT id FROM book WHERE book.title=$1",[title]);
    bookId=result.rows[0].id;
    try{
        await db.query("INSERT INTO notes(summary,book_id) VALUES($1,$2)",[summary,bookId]);
    }catch(err){
        console.log(err);
    }
    res.redirect("/");
});

function createUrl(book){
    const url=book.split(' ');
    const res=url.join('+');
    return res;
}

async function getCoverId(url){
    const response = await axios.get(`https://openlibrary.org/search.json?q=${url}&fields=cover_i&limit=1`);
    const coverId=response.data.docs[0].cover_i;
    return coverId;
}
app.post("/delete",async(req,res)=>{
    const id=req.body.id;
    await db.query("DELETE FROM book WHERE id=$1",[id]);
    res.redirect("/");
});

app.post("/edit",async(req,res)=>{
    const bookId=req.body.id;
    const updatedNotes=req.body.note;
    await db.query("UPDATE notes SET note=$1 WHERE book_id=$2",[updatedNotes,bookId]);
    res.redirect("/");
});
