"use client";

import React,{useState,useEffect} from 'react';
import Tesseract from 'tesseract.js';
import QrScanner from 'qr-scanner';
import './style.css';
import { Modal, Button } from 'react-bootstrap';
import { useContext } from 'react';
//import {AuthContext} from '../login/Auth';
import { DataContext} from './DataContext';
import dateFormat from 'dateformat';
import { DateTime } from 'luxon';
import DateDiff from 'date-diff';
import { addMonths } from '@progress/kendo-date-math';
import axios from 'axios';
import Swal from 'sweetalert2';
//import Alert from 'react-bootstrap/Alert';
import { CopyToClipboard } from "react-copy-to-clipboard";
import { TextField, Alert,Snackbar } from "@mui/material";
import Table from 'react-bootstrap/Table';



const ModalPay = ({setOpenModal,id1,intpay, treepay, rest, due_date,Name, Numpay,row,accumulate}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [progress, setProgress] = useState(0);
  const [ref,setRef] = useState('');
  const [text,setTxt] = useState('');
  const [results, setResults] = useState({});
  const [feedisapp, setFeedisapp] = useState(getFeedisapp());
  const [acrest,setAcRest] = useState(rest-treepay);
  const [totalpay,setTotalpay] = useState(treepay + intpay + feedisapp);

  const {dataInterest,setInterestData} = useContext(DataContext);
  const {dataContact,setDataContact} = useContext(DataContext);
  const {dataTransaction,setTransactionData} = useContext(DataContext);

  const mydate = new Date();
  const [date1,setDate1] =useState(DateTime.fromJSDate(new Date(mydate.getFullYear(),mydate.getMonth(),mydate.getDate())).toFormat("yyyy-MM-dd"));
  const date = dateFormat(date1,'dd/mm/yyyy');

  const [invoiceID, setInvoiceID] = useState('');
  const [error, setError] = useState('');
  const [file,setFile] = useState('');
  // state for text in the text field
  const [text2, setText2] = useState("4260471809");
// state to show the snack bar
  const [copyState, setcopyState] = useState(false);

   //หาเลขที่ใบเสร็จ
   function GetInvoiceNo() {
    let Allinvoice = [];
    dataTransaction.map((val) => {
      if (val.Invoice !== '') {
        Allinvoice.push(val.Invoice);
      }
    })

    let LastID = Allinvoice.pop();

    //const AotoNo = '';
    let Count = LastID.split("/");
    let Poso = (parseInt(mydate.getFullYear()) + 543).toString().substring(2);
    let AotoNo = '';
    
    if( LastID === undefined){
      AotoNo = '001/' + Poso;
    }else if (Count[1] !== Poso) {
      AotoNo = '001/' + Poso;
    } else {
       AotoNo = parseInt(Count[0]) < 9 ?
        '00' + (parseInt(Count[0]) + 1) + '/' + Poso
        : parseInt(Count[0]) < 99 ?
          '0' + (parseInt(Count[0]) + 1) + '/' + Poso
          : parseInt(Count[0]) + 1 + '/' + Poso; 
    }

    setInvoiceID(AotoNo);

  };

  function getFeedisapp(){
    if (!due_date) return 0;
    try {
      let lateDay = (new DateDiff(new Date(),new Date(addMonths(due_date,-1)))).days().toFixed(0) - 4;
      if (lateDay > 0) {
        return lateDay *50;
      } else {
        return 0;
      }
    } catch (e) {
      return 0;
    }
  }

  //เมื่อมีการเพื่มไฟล์
  const handlechange = async (e) => {
    const fileScan = e.target.files[0];
    setFile(e.target.files[0]);
    setImage(URL.createObjectURL(fileScan));
    
    const result2 = await QrScanner.scanImage(fileScan);
    setRef(result2);
  }

  //แปลงข้อความจากสลิบ
  useEffect(()=>{
    if(image!== null){
      setIsLoading(true);
    Tesseract.recognize(image, 'tha', {
      logger: (m) => {
        //console.log(m);
        if (m.status === 'recognizing text') {
          setProgress(parseInt(m.progress * 100));
        }
      },
    })
      .catch((err) => {
        console.error(err);
      })
      .then((result) => {
        //console.log(result.data);
        setTxt(result.data.text);
        setIsLoading(false);
      });
    }
  },[image]); 

 //extractfileTovariable
  useEffect(() => {
    if (text!==""){
      //ชื่อ
      const regexNa = /(นาย|นาง|น.ส.|u.ส.)[ก-๛a-z ]+/g;
      //บัญชีบริษัท
      const regexName = /ทรัพย์สําราญ/;
      //วันที่
      const regexDate = /\d{1,2}\s?(ม.ค.|ก.พ.|มี.ค.|เม.ย.|พ.ค.|มิ.ย.|ก.ค.|ส.ค.|ก.ย.|ต.ค.|พ.ย.|ธ.ค.)\s?(\d{4}|\d{2})/g;
      //จำนวนเงิน
      const regexPay = /([1-9]\d*|0)(?:,[0-9]{3})*(?:\.[0-9]{2})/g;
      
      const matchesNa = text.match(regexNa);
      const matchesName = text.match(regexName);
      const matchesDate = text.match(regexDate);
      const matchesPay = text.match(regexPay)[0];
    
        return setResults({"na":matchesNa,"name": matchesName , "date" : matchesDate, "pay" : matchesPay});

    }
  },[text]);

  useEffect(()=>{
    if (dataTransaction !== null){
      GetInvoiceNo();
    }
  },[]);
  

  // verify จำนวนยอดเงินที่ต้องจ่าย ชื่อบริษัท วันที่ให้ตรงกับยอดที่แสดงในตารางค่างวด

const ConvertMonthToNum = (text)=>{
  let monthArr = {'ม.ค.':1,'ก.พ.':2,'มี.ค.':3,'เม.ย.':4,'พ.ค.':5,'มิ.ย.':6,'ก.ค.':7,'ส.ค.':8,'ก.ย.':9,'ต.ค.':10,'พ.ย.':11,'ธ.ค.':12};
  return monthArr[text];
}

//console.log('test',results);

  const verify = async ()=>{

    //ตรวจสอบวันที่
    const today1 = new Date();
    const d = today1.getDate();
    const m = today1.getMonth()+1;
    const y = today1.getFullYear()+543;
    let checkY = '';
    let checkArr = [];
    //error ถ้ายังไม่อัพโหลด
    
    if (Object.keys(results).length !== 0 ){
      if (results.date == null){
        return ('ไม่สามารถอ่านสลิปได้ กรุณาติดต่อเจ้าหน้าที่');
      }else{
        const checkdate = results.date;
        checkArr = checkdate.toString().split(" ");
        if (checkArr[2].length === 4){
          checkY = y;
        }else{
          checkY = y.toString().substr(2,4);
        }
      }
    }else{
      return ('กรุณาอัพโหลดสลิป');
    }
    

    //ตรวจสอบรหัสอ้างอิงซ้ำ       
    if ( dataInterest != null && ref !== ''){
      dataInterest.map((val)=>{
        if (val.ref_code === ref){
          return ('โปรดตรวจสอบสลิปซ้ำ');
        }
      })
    }

    if (!results.pay){
      return ('กรุณาเลือกไฟล์สลิบ');
    }else if(Number(results.pay) !== Number(treepay + intpay + feedisapp)){
      return ('ไม่สามารถแจ้งชำระได้ กรุณาติดต่อเจ้าหน้าที่ เนื่องจากยอดเงินไม่ตรงครับ');
    }else if(results.name != "ทรัพย์สําราญ"){
      return ('ไม่สามารถแจ้งชำระได้ กรุณาติดต่อเจ้าหน้าที่ กรุณาตรวจเชคบัญชี');
    }else if(d !== checkArr[0] && m !== ConvertMonthToNum(checkArr[1]) && checkY !== checkArr[2]){ 
      return ('ไม่สามารถแจ้งชำระได้ กรุณาติดต่อเจ้าหน้าที่ กรุณาตรวจสอบวันที่โอน');
    }else{
      return ('');
    }

  }

   

  
     //insert data  to transanction ขาด 
  const payData = {
    type: 'จ่าย',
    Invoice: invoiceID,
    ID_contact: id1,
    Number_pay: Numpay,
    begindate: date1,
    Number_date: '',
    details: Name,
    type_income: 'เลขที่สัญญา ' + id1,
    tree: treepay,
    interest: intpay,
    fee1: 0,
    fee2: feedisapp,
    fee3: 0,
    payfee2: 0,
    payfee3: 0,
    loan_out: '',
    payroute: 'เงินโอน',
    accu: 0
  };
  
  const due = (due_date && due_date !== '-' && typeof due_date.getDate === 'function')
    ? (due_date.getDate() + '/' + (due_date.getMonth() + 1) + '/' + due_date.getFullYear())
    : '-';
  
  const interestchart = {
    Row: row,
    pay_date: date,
    reference: invoiceID,
    paytree: treepay,
    payinter: intpay,
    dis_fee2: 0,
    dis_fee3: 0,
    payfee2: feedisapp,
    payfee3: 0,
    Rest: acrest,
    due_date: due,
    accu: 0 ,
    payroute: 'เงินโอน',
    ref_code: ref,
  };

  //console.log(payData);
  //console.log(interestchart); 

  //มีกา่รอัพโหลดไฟล์รูปสลิปไปยัง google drive ,
  //บันทึก log 
  //แก้ไขไฟล์ contact, interest chart, transaction ,
  //ส่งline หาลูกค้า

  //console.log(file);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
  
    const P1 = await verify();
    setError(P1);
    //console.log('p',P1);
    if (P1 === ''){ 
       Swal.fire({
      title: 'คุณต้องการชำระทั้งหมด ' + totalpay + ' บาท ใช่หรือไม่?',
      text: "กรุณาตรวจสอบข้อมูล แล้วกดตกลง",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ตกลง',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      })
      .then((result) => {
        if (result.isDismissed){
          setOpenModal(true);
        }
         if (result.isConfirmed){
          //บันทึกรูปลงใน google drive
 /* 
            if (file!==null){
                            var reader = new FileReader(); //this for convert to Base64 
                            reader.readAsDataURL(file); //start conversion...
                            reader.onload = function (e) { //.. once finished..
                                console.log('img',reader.result);
                                var rawLog = reader.result.split(',')[1]; //extract only thee file data part
                            }
            }
                  
                            fetch('https://script.google.com/macros/s/AKfycbyFKtdje6wHYBoweOVqgHA57bR0lKA_Tmq5XFSye0hmS63DuOxUd3GumsK33qepg0O-/exec', //your AppsScript URL
                                { method: "POST", body: JSON.stringify({ dataReq: { dataraw: rawLog, Name: Name, type: file.type }, user : userData, fname: "uploadFilesToGoogleDrive" })}) //send to Api

          //transaction
          fetch('https://script.google.com/macros/s/AKfycbw68wPHu0gaExas0B31vjNIHX7rYLXFTAjBC3pLucsrf_Q495vrluPRrJNSTmtsH9k/exec', //your AppsScript URL
            { method: "POST", body: JSON.stringify(payData) }) //send to Api
            .then(() => {
              axios.get('https://script.google.com/macros/s/AKfycbwSsQALv9QSHokIwpwTOaPfisKscESJOY1Ha3QzWWUw-QVhHt3Dl6GpXXoTiwq_HYbL/exec')
              .then(res => setTransactionData(res.data));
            })
            .then((a) => {
              console.log(a); //See response
            }).catch(e => console.log(e)) // Or Error in console     

          //contact เพิ่มวันครบกำหนดชำระ วันชำระครั้งสุดท้าย เงินต้นคงเหลือ ยอดเงินสะสม
          fetch('https://script.google.com/macros/s/AKfycbxmDzTRcWp7UhwEGc9CS307YU7dW-ruS8f3nob3ffTq1i4YssMPiwnr6QGbq1n8lzSn0g/exec', //your AppsScript URL
            { method: "POST", body: JSON.stringify({ duedate: due, ID_contact: id1, lastpay: date, total_treerest: acrest, accumulate:  accumulate}) }) //send to Api
            .then(() => {
              axios.get('https://script.google.com/macros/s/AKfycbz6AkG3mCrT11X9pib9sZ2T5DMfTVPtOjInEoFYq5-_f57U9EC3gvIa0AjiZhrZOqOxFA/exec')
              .then(res => setDataContact(res.data));
            })
            .then((a) => {
              console.log(a); //See response
            }).catch(e => console.log(e)) // Or Error in console     

          //interest chart
          fetch('https://script.google.com/macros/s/AKfycbz1Ci0ew_foS6p1hs6ngiE8ATMUbgyPxHYMpSIi-1Maf9NNG5L5s7ddFz0P6KqNyg4B/exec', //your AppsScript URL
            { method: "POST", body: JSON.stringify(interestchart) }) //send to Api
            .then(res => {
              Swal.fire({
                position: 'top-right',
                icon: 'success',
                title: 'ชำระเงินเรียบร้อย',
                showConfirmButton: false,
                timer: 2000
              })
            })

            //เพิ่มว่าให้ไปหน้า invoice พร้อมด้วย invoiceID

            .then(() => {
              axios.get('https://script.google.com/macros/s/AKfycbxVVFZbJcX8I6_0qBMxjHru0gZgA4hPXcWMvi7K60qHmoKfao8-zMsI8RtiaxiYwmh3Ww/exec')
              .then(res => setInterestData(res.data));
            })
            .then(() => {
              axios.get('https://script.google.com/macros/s/AKfycbz6AkG3mCrT11X9pib9sZ2T5DMfTVPtOjInEoFYq5-_f57U9EC3gvIa0AjiZhrZOqOxFA/exec')
              .then(res=>setDataContact(res.data));
            })
            .then(() => {
              axios.get('https://script.google.com/macros/s/AKfycbwSsQALv9QSHokIwpwTOaPfisKscESJOY1Ha3QzWWUw-QVhHt3Dl6GpXXoTiwq_HYbL/exec')
              .then(res=>setTransactionData(res.data));
            })
            .then(setOpenModal(false))
            .then((a) => {
              console.log(a); //See response
            }).catch(e => console.log(e)) // Or Error in console      */
        } 

      }); 
    }
  }



  return (
    <>
      <Modal size="lg" show={true}>
        <Modal.Header>
          <Modal.Title>
            <h2>แจ้งชำระค่างวด(โดยลูกค้าทำเอง)</h2>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
    
                  <div className="container">
                      <div className="d-flex flex-column justify-content-center">
                        
                   
                          {/* อ่าน qrcode รหัสอ้างอิง */}
                              <h3>ขั้นตอนที่ 1 โอนเงิน เข้าบัญชี</h3> 
                              <p>ชื่อ <u>ทรัพย์สําราญ พิโก จำกัด</u></p> 
                              <p>เลขที่บัญชี <u>426-047180-9</u></p>
                              <div style={{align: 'center'}}>
                                <img src={require('./SCB-logo.png')} alt="SCB" width="200" height="70"/>
                              </div>
                              <br></br>
                              <TextField
                                type="text"
                                value={text2}
                                id="outlined-basic"
                                label="เลขที่บัญชี"
                                // design of text field
                                variant="outlined"
                                placeholder="Type some text here"
                                //onChange={(e) => setText2(e.target.value)}
                                disabled
                                hidden
                              />
                              <CopyToClipboard     text={text2} onCopy={() => setcopyState(true)} >
                                <div className="copy-area">
                                  {/*button to copy text */}
                                  <Button variant="warning">
                                      คัดลอก เลขที่บัญชี
                                  </Button>
                                </div>
                              </CopyToClipboard> 
                              
                          
                              <Snackbar
                                // invoke snack bar when open is true
                                open={copyState}
                                // close after three seconds
                                autoHideDuration={3000}
                                // function called after three seconds
                                onClose={() => setcopyState(false)}
                                // where the snack bar must be shown
                                anchorOrigin={{ 
                                      vertical: "top",
                                      horizontal: "center" 
                                }}
                              >
                                <Alert
                                  // function called by clicking the close icon
                                  onClose={() => setcopyState(false)}
                                  // color of snack bar
                                  severity="success"
                                  sx={{ width: "100%" }}
                                >
                                  คัดลอกเรียบร้อย
                                </Alert>
                              </Snackbar>
                                <br></br>
                              <p>จำนวนเงินที่ต้องจ่าย</p>
                              <Table striped bordered hover >
                                <tbody>
                                <tr>
                                  <td>เงินต้น</td>
                                  <td>{treepay}</td>
                                  <td>บาท</td>
                                </tr>
                                <tr>
                                  <td>ดอกเบี้ย</td>
                                  <td>{intpay}</td>
                                  <td>บาท</td>
                                </tr>
                                <tr>
                                  <td>ค่าปรับ</td>
                                  <td>{feedisapp}</td>
                                  <td>บาท</td>
                                </tr>
                                <tr>
                                  <td>รวมเป็นเงิน</td>
                                  <td>{treepay + intpay + feedisapp}</td>
                                  <td>บาท</td>
                                </tr>
                                </tbody>
                              </Table>
                        
                              <h3>ขั้นตอนที่ 2 อัพโหลดสลิปโอนเงิน</h3>
                              <div className='col-center'> 
                                <input type="file" onChange={handlechange} required />                     
                                {image && <img src={image} width="150" height="250"/>}
                              </div>
                      
                        {isLoading && (
                          <>
                            <progress className="form-control" value={progress} max="100">
                              {progress}%{' '}
                            </progress>{' '}
                            <p className="text-center py-0 my-0">กำลังอัพโหลด: {progress} %</p>
                          </>
                        )}

                        {!isLoading && text && (
                          <>
                         {/*  <textarea>
                            {text}
                          </textarea> */}
                              <p>รหัสอ้างอิง:{ref}</p>
                              <p>ชื่อ:{results.na}</p>
                              <p>บัญชี:{results.name}</p>
                              <p>วันที่:{results.date}</p>
                              <p>จำนวน:{results.pay}</p>
                          </>
                        )}
                        <h3>ขั้นตอนที่ 3 กดยืนยัน</h3>
                        {error && <Alert severity="warning">{error}</Alert>}
                      </div>
                  </div>

                  
        </Modal.Body>
        <Modal.Footer>
                <Button variant="primary" onClick={handleSubmit}>ยืนยัน</Button>
                <Button variant="secondary" onClick={()=>setOpenModal(false)}>ปิด</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ModalPay;