// 50 WhatsApp conversations — Valuador de Autos y/o Moto — SELECTA Consultores
// Agent: Sofia (IA) — ALWAYS follows this exact flow:
// 1. Greeting + permission  2. City  3. License  4. Mechanic exp  5. Education  6. Age  7. Schedule  8. Interview date

const GREETING = (name) => `Hola ${name}! 👋 Gracias por tu interes en la vacante de Valuador de Autos y Motos en SELECTA Consultores.\n\n¿Me permites hacerte unas preguntas para validar tu perfil?`
const Q_CITY = '¿En que ciudad te encuentras?'
const Q_LICENSE = '¿Cuentas con licencia de manejo vigente?'
const Q_MECHANIC = '¿Tienes experiencia en mecanica automotriz o valuacion de vehiculos?'
const Q_EDUCATION = '¿Cual es tu escolaridad?'
const Q_AGE = '¿Que edad tienes?'
const Q_SCHEDULE = '¿Tienes disponibilidad de horario de lunes a viernes de 9:30 a 6:30 y sabados de 9:30 a 3:00?'
const Q_INTERVIEW = (city) => `Excelente, tu perfil cumple todos los requisitos. ✅\n\nEl puesto ofrece:\n• Sueldo base: $9,900 - $11,300 MXN\n• Comisiones: $5,000 - $6,000\n• Prestaciones de ley\n• Apoyo para traslados\n\n¿Cuando podrias asistir a una entrevista en nuestra sucursal de ${city}?`

const addresses = {
  'Guadalajara': 'Calle Longinos Cadena 2013, Lomas de Polanco, CP 44960, Guadalajara',
  'Merida': 'Calle 21 #327, Col. Miguel Hidalgo (Plaza las Americas), Merida',
  'Mixcoac': 'Molinos Local L y M, Col. Mixcoac, Benito Juarez, CDMX',
  'Ixtapaluca': 'Av. Cuauhtemoc 15, Local 13, Col. Jose de la Palma, Ixtapaluca',
  'Minatitlan': 'Calle Hidalgo 103, Col. Centro, Minatitlan, Veracruz',
  'Tehuacan': 'Calle 3 Oriente #130, Centro, Tehuacan, Puebla',
}

const CONFIRM_INTERVIEW = (name, day, time, city) =>
  `Perfecto ${name}, tu entrevista queda agendada:\n\n📅 ${day} a las ${time}\n📍 ${addresses[city] || city}\n\nPregunta por el Gerente de Sucursal. Lleva identificacion oficial y licencia de manejo.\n\n¡Mucho exito! 🤝`

const conversations = [
  // ==================== SCHEDULED (15) ====================
  {
    id:1, name:'Carlos Alberto Martinez', phone:'+52 33 1847 2936', location:'Guadalajara, Jalisco',
    status:'scheduled', avatar:'CM', time:'9:42 AM', unread:0,
    lastMsg:'Tu entrevista queda agendada para el jueves...',
    messages:[
      {from:'lead',text:'Hola, me interesa la vacante de Valuador de Autos',time:'9:12 AM'},
      {from:'agent',text:GREETING('Carlos'),time:'9:12 AM'},
      {from:'lead',text:'Si claro, adelante',time:'9:13 AM'},
      {from:'agent',text:Q_CITY,time:'9:13 AM'},
      {from:'lead',text:'En Guadalajara, Jalisco',time:'9:14 AM'},
      {from:'agent',text:Q_LICENSE,time:'9:14 AM'},
      {from:'lead',text:'Si, licencia tipo A vigente',time:'9:15 AM'},
      {from:'agent',text:Q_MECHANIC,time:'9:15 AM'},
      {from:'lead',text:'Si, trabaje 3 anos en un taller mecanico y actualmente soy asesor en agencia',time:'9:18 AM'},
      {from:'agent',text:Q_EDUCATION,time:'9:18 AM'},
      {from:'lead',text:'Preparatoria terminada',time:'9:19 AM'},
      {from:'agent',text:Q_AGE,time:'9:19 AM'},
      {from:'lead',text:'28 anos',time:'9:20 AM'},
      {from:'agent',text:Q_SCHEDULE,time:'9:20 AM'},
      {from:'lead',text:'Si, sin problema',time:'9:21 AM'},
      {from:'agent',text:Q_INTERVIEW('Guadalajara'),time:'9:25 AM'},
      {from:'lead',text:'El jueves a las 10 de la manana',time:'9:28 AM'},
      {from:'agent',text:CONFIRM_INTERVIEW('Carlos','Jueves','10:00 AM','Guadalajara'),time:'9:42 AM'},
    ]
  },
  {
    id:2, name:'Diana Patricia Rivera', phone:'+52 99 2341 5678', location:'Merida, Yucatan',
    status:'scheduled', avatar:'DR', time:'10:15 AM', unread:0,
    lastMsg:'Tu entrevista queda agendada para el miercoles...',
    messages:[
      {from:'lead',text:'Buenas tardes, vi el anuncio de valuador',time:'10:01 AM'},
      {from:'agent',text:GREETING('Diana'),time:'10:01 AM'},
      {from:'lead',text:'Claro que si',time:'10:02 AM'},
      {from:'agent',text:Q_CITY,time:'10:02 AM'},
      {from:'lead',text:'Merida, Yucatan',time:'10:03 AM'},
      {from:'agent',text:Q_LICENSE,time:'10:03 AM'},
      {from:'lead',text:'Si, licencia vigente',time:'10:04 AM'},
      {from:'agent',text:Q_MECHANIC,time:'10:04 AM'},
      {from:'lead',text:'5 anos en cobranza de creditos automotrices, conozco el proceso',time:'10:06 AM'},
      {from:'agent',text:Q_EDUCATION,time:'10:06 AM'},
      {from:'lead',text:'Preparatoria',time:'10:07 AM'},
      {from:'agent',text:Q_AGE,time:'10:07 AM'},
      {from:'lead',text:'31 anos',time:'10:08 AM'},
      {from:'agent',text:Q_SCHEDULE,time:'10:08 AM'},
      {from:'lead',text:'Si',time:'10:09 AM'},
      {from:'agent',text:Q_INTERVIEW('Merida'),time:'10:10 AM'},
      {from:'lead',text:'Miercoles en la manana',time:'10:12 AM'},
      {from:'agent',text:CONFIRM_INTERVIEW('Diana','Miercoles','11:00 AM','Merida'),time:'10:15 AM'},
    ]
  },
  {
    id:3, name:'Fernanda Alejandra Cruz', phone:'+52 55 9182 7364', location:'Ixtapaluca, Edo. Mex',
    status:'scheduled', avatar:'FC', time:'9:50 AM', unread:0,
    lastMsg:'Tu entrevista queda agendada para el viernes...',
    messages:[
      {from:'lead',text:'Buenos dias, me interesa aplicar para valuador',time:'9:30 AM'},
      {from:'agent',text:GREETING('Fernanda'),time:'9:30 AM'},
      {from:'lead',text:'Si, con gusto',time:'9:31 AM'},
      {from:'agent',text:Q_CITY,time:'9:31 AM'},
      {from:'lead',text:'Ixtapaluca, Estado de Mexico',time:'9:32 AM'},
      {from:'agent',text:Q_LICENSE,time:'9:32 AM'},
      {from:'lead',text:'Si, tengo licencia y auto propio',time:'9:33 AM'},
      {from:'agent',text:Q_MECHANIC,time:'9:33 AM'},
      {from:'lead',text:'Trabaje 2 anos en Monte de Piedad valuando autos',time:'9:35 AM'},
      {from:'agent',text:Q_EDUCATION,time:'9:35 AM'},
      {from:'lead',text:'Preparatoria',time:'9:36 AM'},
      {from:'agent',text:Q_AGE,time:'9:36 AM'},
      {from:'lead',text:'26 anos',time:'9:37 AM'},
      {from:'agent',text:Q_SCHEDULE,time:'9:37 AM'},
      {from:'lead',text:'Si, totalmente',time:'9:38 AM'},
      {from:'agent',text:Q_INTERVIEW('Ixtapaluca'),time:'9:40 AM'},
      {from:'lead',text:'El viernes temprano',time:'9:42 AM'},
      {from:'agent',text:CONFIRM_INTERVIEW('Fernanda','Viernes','9:30 AM','Ixtapaluca'),time:'9:50 AM'},
    ]
  },
  {
    id:4, name:'Luis Fernando Torres', phone:'+52 33 5521 8834', location:'Guadalajara, Jalisco',
    status:'scheduled', avatar:'LT', time:'11:20 AM', unread:0, lastMsg:'Tu entrevista queda agendada para el lunes...',
    messages:[
      {from:'lead',text:'Hola, vi su anuncio en Facebook',time:'11:00 AM'},{from:'agent',text:GREETING('Luis'),time:'11:00 AM'},
      {from:'lead',text:'Si',time:'11:01 AM'},{from:'agent',text:Q_CITY,time:'11:01 AM'},
      {from:'lead',text:'Guadalajara',time:'11:02 AM'},{from:'agent',text:Q_LICENSE,time:'11:02 AM'},
      {from:'lead',text:'Si',time:'11:03 AM'},{from:'agent',text:Q_MECHANIC,time:'11:03 AM'},
      {from:'lead',text:'Soy mecanico automotriz de profesion',time:'11:04 AM'},{from:'agent',text:Q_EDUCATION,time:'11:04 AM'},
      {from:'lead',text:'Carrera tecnica',time:'11:05 AM'},{from:'agent',text:Q_AGE,time:'11:05 AM'},
      {from:'lead',text:'35',time:'11:06 AM'},{from:'agent',text:Q_SCHEDULE,time:'11:06 AM'},
      {from:'lead',text:'Si',time:'11:07 AM'},{from:'agent',text:Q_INTERVIEW('Guadalajara'),time:'11:08 AM'},
      {from:'lead',text:'Lunes en la tarde',time:'11:10 AM'},
      {from:'agent',text:CONFIRM_INTERVIEW('Luis','Lunes','2:00 PM','Guadalajara'),time:'11:20 AM'},
    ]
  },
  {
    id:5, name:'Alejandro David Castillo', phone:'+52 99 3456 7890', location:'Merida, Yucatan',
    status:'scheduled', avatar:'AC', time:'2:30 PM', unread:0, lastMsg:'Tu entrevista queda agendada para el jueves...',
    messages:[
      {from:'lead',text:'Buenas, quiero aplicar para la vacante',time:'2:10 PM'},{from:'agent',text:GREETING('Alejandro'),time:'2:10 PM'},
      {from:'lead',text:'Si',time:'2:11 PM'},{from:'agent',text:Q_CITY,time:'2:11 PM'},
      {from:'lead',text:'Merida',time:'2:12 PM'},{from:'agent',text:Q_LICENSE,time:'2:12 PM'},
      {from:'lead',text:'Si',time:'2:13 PM'},{from:'agent',text:Q_MECHANIC,time:'2:13 PM'},
      {from:'lead',text:'Trabaje en lote de autos seminuevos 4 anos',time:'2:14 PM'},{from:'agent',text:Q_EDUCATION,time:'2:14 PM'},
      {from:'lead',text:'Prepa',time:'2:15 PM'},{from:'agent',text:Q_AGE,time:'2:15 PM'},
      {from:'lead',text:'29',time:'2:16 PM'},{from:'agent',text:Q_SCHEDULE,time:'2:16 PM'},
      {from:'lead',text:'Si',time:'2:17 PM'},{from:'agent',text:Q_INTERVIEW('Merida'),time:'2:20 PM'},
      {from:'lead',text:'Jueves a las 3',time:'2:22 PM'},
      {from:'agent',text:CONFIRM_INTERVIEW('Alejandro','Jueves','3:00 PM','Merida'),time:'2:30 PM'},
    ]
  },
  {
    id:6, name:'Sergio Adrian Alvarez', phone:'+52 55 4432 1987', location:'Mixcoac, CDMX',
    status:'scheduled', avatar:'SA', time:'3:15 PM', unread:0, lastMsg:'Tu entrevista queda agendada para el martes...',
    messages:[
      {from:'lead',text:'Me interesa el puesto de valuador en CDMX',time:'2:50 PM'},{from:'agent',text:GREETING('Sergio'),time:'2:50 PM'},
      {from:'lead',text:'Dale',time:'2:51 PM'},{from:'agent',text:Q_CITY,time:'2:51 PM'},
      {from:'lead',text:'Mixcoac, CDMX',time:'2:52 PM'},{from:'agent',text:Q_LICENSE,time:'2:52 PM'},
      {from:'lead',text:'Si, tipo A y B',time:'2:53 PM'},{from:'agent',text:Q_MECHANIC,time:'2:53 PM'},
      {from:'lead',text:'6 anos como perito valuador de seguros',time:'2:54 PM'},{from:'agent',text:Q_EDUCATION,time:'2:54 PM'},
      {from:'lead',text:'Universidad trunca',time:'2:55 PM'},{from:'agent',text:Q_AGE,time:'2:55 PM'},
      {from:'lead',text:'33',time:'2:56 PM'},{from:'agent',text:Q_SCHEDULE,time:'2:56 PM'},
      {from:'lead',text:'Si',time:'2:57 PM'},{from:'agent',text:Q_INTERVIEW('Mixcoac'),time:'3:00 PM'},
      {from:'lead',text:'Martes en la manana',time:'3:02 PM'},
      {from:'agent',text:CONFIRM_INTERVIEW('Sergio','Martes','10:00 AM','Mixcoac'),time:'3:15 PM'},
    ]
  },
  {
    id:7, name:'Arturo Javier Campos', phone:'+52 92 1456 3344', location:'Minatitlan, Veracruz',
    status:'scheduled', avatar:'AJ', time:'4:10 PM', unread:0, lastMsg:'Tu entrevista queda agendada para el miercoles...',
    messages:[
      {from:'lead',text:'Buen dia, vi la vacante de valuador',time:'3:45 PM'},{from:'agent',text:GREETING('Arturo'),time:'3:45 PM'},
      {from:'lead',text:'Si',time:'3:46 PM'},{from:'agent',text:Q_CITY,time:'3:46 PM'},
      {from:'lead',text:'Minatitlan, Veracruz',time:'3:47 PM'},{from:'agent',text:Q_LICENSE,time:'3:47 PM'},
      {from:'lead',text:'Si',time:'3:48 PM'},{from:'agent',text:Q_MECHANIC,time:'3:48 PM'},
      {from:'lead',text:'Trabaje en taller mecanico 2 anos',time:'3:49 PM'},{from:'agent',text:Q_EDUCATION,time:'3:49 PM'},
      {from:'lead',text:'Prepa',time:'3:50 PM'},{from:'agent',text:Q_AGE,time:'3:50 PM'},
      {from:'lead',text:'27',time:'3:51 PM'},{from:'agent',text:Q_SCHEDULE,time:'3:51 PM'},
      {from:'lead',text:'Si',time:'3:52 PM'},{from:'agent',text:Q_INTERVIEW('Minatitlan'),time:'3:55 PM'},
      {from:'lead',text:'Miercoles',time:'3:58 PM'},
      {from:'agent',text:CONFIRM_INTERVIEW('Arturo','Miercoles','11:00 AM','Minatitlan'),time:'4:10 PM'},
    ]
  },
  {
    id:8, name:'Ricardo Antonio Dominguez', phone:'+52 22 5566 7788', location:'Tehuacan, Puebla',
    status:'scheduled', avatar:'RD', time:'10:45 AM', unread:0, lastMsg:'Tu entrevista queda agendada para el viernes...',
    messages:[
      {from:'lead',text:'Hola, quiero info de la vacante en Tehuacan',time:'10:20 AM'},{from:'agent',text:GREETING('Ricardo'),time:'10:20 AM'},
      {from:'lead',text:'Si',time:'10:21 AM'},{from:'agent',text:Q_CITY,time:'10:21 AM'},
      {from:'lead',text:'Tehuacan, Puebla',time:'10:22 AM'},{from:'agent',text:Q_LICENSE,time:'10:22 AM'},
      {from:'lead',text:'Si',time:'10:23 AM'},{from:'agent',text:Q_MECHANIC,time:'10:23 AM'},
      {from:'lead',text:'Tengo taller propio chico',time:'10:24 AM'},{from:'agent',text:Q_EDUCATION,time:'10:24 AM'},
      {from:'lead',text:'Prepa',time:'10:25 AM'},{from:'agent',text:Q_AGE,time:'10:25 AM'},
      {from:'lead',text:'30',time:'10:26 AM'},{from:'agent',text:Q_SCHEDULE,time:'10:26 AM'},
      {from:'lead',text:'Si',time:'10:27 AM'},{from:'agent',text:Q_INTERVIEW('Tehuacan'),time:'10:30 AM'},
      {from:'lead',text:'Viernes temprano',time:'10:32 AM'},
      {from:'agent',text:CONFIRM_INTERVIEW('Ricardo','Viernes','9:00 AM','Tehuacan'),time:'10:45 AM'},
    ]
  },
  ...[
    {id:9,name:'Gerardo Isaac Villegas',phone:'+52 33 7788 9900',loc:'Guadalajara, Jalisco',avatar:'GV',time:'1:30 PM',exp:'Vendi autos 5 anos en agencia Honda',age:'32',edu:'Prepa',day:'Lunes',hora:'11:00 AM',city:'Guadalajara'},
    {id:10,name:'Mariana Isabel Rojas',phone:'+52 99 1122 3344',loc:'Merida, Yucatan',avatar:'MR',time:'11:55 AM',exp:'Trabaje en empenera valuando',age:'25',edu:'Prepa',day:'Jueves',hora:'9:30 AM',city:'Merida'},
    {id:11,name:'Pedro Daniel Sandoval',phone:'+52 55 6677 8899',loc:'Ixtapaluca, Edo. Mex',avatar:'PS',time:'4:40 PM',exp:'Repartidor, conozco de motos',age:'24',edu:'Prepa',day:'Miercoles',hora:'2:00 PM',city:'Ixtapaluca'},
    {id:12,name:'Victor Hugo Lara',phone:'+52 33 2233 4455',loc:'Guadalajara, Jalisco',avatar:'VL',time:'5:10 PM',exp:'Trabaje en refaccionaria 3 anos',age:'38',edu:'Prepa',day:'Martes',hora:'3:00 PM',city:'Guadalajara'},
    {id:13,name:'Mauricio Andres Bernal',phone:'+52 92 4455 6677',loc:'Minatitlan, Veracruz',avatar:'MB',time:'12:30 PM',exp:'Conozco de mecanica, trabaje en taller',age:'34',edu:'Prepa',day:'Jueves',hora:'10:00 AM',city:'Minatitlan'},
    {id:14,name:'Ivan Alejandro Serrano',phone:'+52 22 7788 9900',loc:'Tehuacan, Puebla',avatar:'IS',time:'3:45 PM',exp:'Fui valuador en otra empresa',age:'27',edu:'Prepa',day:'Lunes',hora:'10:00 AM',city:'Tehuacan'},
    {id:15,name:'Daniela Sophia Guerrero',phone:'+52 55 3344 5566',loc:'Mixcoac, CDMX',avatar:'DG',time:'10:30 AM',exp:'Trabaje en aseguradora ajustando siniestros',age:'29',edu:'Universidad trunca',day:'Viernes',hora:'11:00 AM',city:'Mixcoac'},
  ].map(c => ({
    id:c.id, name:c.name, phone:c.phone, location:c.loc, status:'scheduled', avatar:c.avatar, time:c.time, unread:0,
    lastMsg:'Tu entrevista queda agendada...',
    messages:[
      {from:'lead',text:'Hola, me interesa la vacante',time:c.time},
      {from:'agent',text:GREETING(c.name.split(' ')[0]),time:c.time},
      {from:'lead',text:'Si',time:c.time},
      {from:'agent',text:Q_CITY,time:c.time},
      {from:'lead',text:c.loc.split(',')[0],time:c.time},
      {from:'agent',text:Q_LICENSE,time:c.time},
      {from:'lead',text:'Si',time:c.time},
      {from:'agent',text:Q_MECHANIC,time:c.time},
      {from:'lead',text:c.exp,time:c.time},
      {from:'agent',text:Q_EDUCATION,time:c.time},
      {from:'lead',text:c.edu,time:c.time},
      {from:'agent',text:Q_AGE,time:c.time},
      {from:'lead',text:c.age+' anos',time:c.time},
      {from:'agent',text:Q_SCHEDULE,time:c.time},
      {from:'lead',text:'Si',time:c.time},
      {from:'agent',text:Q_INTERVIEW(c.city),time:c.time},
      {from:'lead',text:c.day,time:c.time},
      {from:'agent',text:CONFIRM_INTERVIEW(c.name.split(' ')[0],c.day,c.hora,c.city),time:c.time},
    ]
  })),

  // ==================== TALKING (10) ====================
  ...[
    {id:16,name:'Roberto Carlos Ramirez',phone:'+52 55 3219 8745',loc:'Mixcoac, CDMX',avatar:'RR',time:'11:30 AM',step:4,ans:['Mixcoac CDMX','Si']},
    {id:17,name:'Miguel Angel Lopez',phone:'+52 99 1234 5671',loc:'Merida, Yucatan',avatar:'ML',time:'12:05 PM',step:6,ans:['Merida','Si','Soy tecnico automotriz','Prepa']},
    {id:18,name:'Juan Pablo Diaz',phone:'+52 22 8765 4321',loc:'Tehuacan, Puebla',avatar:'JD',time:'1:20 PM',step:7,ans:['Tehuacan','Si','Mi papa tiene taller, le ayudo','Prepa','23']},
    {id:19,name:'Oscar Emilio Medina',phone:'+52 33 9988 7766',loc:'Guadalajara, Jalisco',avatar:'OM',time:'2:45 PM',step:3,ans:['Guadalajara']},
    {id:20,name:'Raul Ernesto Guzman',phone:'+52 55 1122 3344',loc:'Ixtapaluca, Edo. Mex',avatar:'RG',time:'3:30 PM',step:5,ans:['Ixtapaluca','Si','Soy chofer de Uber, conozco de carros']},
    {id:21,name:'Valeria Montserrat Ramos',phone:'+52 99 5566 7788',loc:'Merida, Yucatan',avatar:'VR',time:'4:15 PM',step:6,ans:['Merida','Si','Trabaje en agencia de autos','Prepa']},
    {id:22,name:'Francisco Javier Herrera',phone:'+52 33 4455 6677',loc:'Guadalajara, Jalisco',avatar:'FH',time:'5:00 PM',step:7,ans:['Guadalajara','Si','Si, conozco','Prepa','40']},
    {id:23,name:'Natalia Camila Vazquez',phone:'+52 55 8899 0011',loc:'Mixcoac, CDMX',avatar:'NV',time:'9:15 AM',step:4,ans:['CDMX zona Mixcoac','Si']},
    {id:24,name:'Enrique Armando Cardenas',phone:'+52 92 6677 8899',loc:'Minatitlan, Veracruz',avatar:'EC',time:'11:10 AM',step:5,ans:['Minatitlan','Si','Conozco de mecanica']},
    {id:25,name:'Jorge Alberto Figueroa',phone:'+52 22 3344 5566',loc:'Tehuacan, Puebla',avatar:'JF',time:'2:20 PM',step:3,ans:['Tehuacan']},
  ].map(c => {
    const questions = [Q_CITY, Q_LICENSE, Q_MECHANIC, Q_EDUCATION, Q_AGE, Q_SCHEDULE]
    const msgs = [
      {from:'lead',text:'Hola, me interesa la vacante',time:c.time},
      {from:'agent',text:GREETING(c.name.split(' ')[0]),time:c.time},
      {from:'lead',text:'Si',time:c.time},
    ]
    for (let i = 0; i < c.step - 2 && i < questions.length; i++) {
      msgs.push({from:'agent',text:questions[i],time:c.time})
      if (c.ans[i]) msgs.push({from:'lead',text:c.ans[i],time:c.time})
    }
    msgs.push({from:'agent',text:questions[c.step-2] || Q_SCHEDULE,time:c.time})
    const lastQ = questions[c.step-2] || Q_SCHEDULE
    return {
      id:c.id, name:c.name, phone:c.phone, location:c.loc, status:'talking', avatar:c.avatar, time:c.time, unread:1,
      lastMsg:lastQ.slice(0,40)+'...',
      messages:msgs
    }
  }),

  // ==================== REJECTED (10) ====================
  {
    id:26, name:'Jose Luis Sanchez', phone:'+52 33 7654 1298', location:'Guadalajara, Jalisco',
    status:'rejected', avatar:'JS', time:'8:55 AM', unread:0,
    lastMsg:'La licencia de manejo vigente es requisito...',
    messages:[
      {from:'lead',text:'Hola, me interesa el puesto',time:'8:40 AM'},{from:'agent',text:GREETING('Jose Luis'),time:'8:40 AM'},
      {from:'lead',text:'Si',time:'8:41 AM'},{from:'agent',text:Q_CITY,time:'8:41 AM'},
      {from:'lead',text:'Guadalajara',time:'8:42 AM'},{from:'agent',text:Q_LICENSE,time:'8:42 AM'},
      {from:'lead',text:'No, la verdad no tengo licencia ahorita',time:'8:43 AM'},
      {from:'agent',text:'La licencia de manejo vigente es un requisito indispensable para esta posicion, ya que el 60% del trabajo es en campo.\n\nTe recomiendo tramitarla y volver a aplicar. ¡Gracias por tu interes!',time:'8:55 AM'},
    ]
  },
  {
    id:27, name:'Eduardo Antonio Reyes', phone:'+52 92 1456 7832', location:'Coatzacoalcos, Veracruz',
    status:'rejected', avatar:'ER', time:'10:40 AM', unread:0,
    lastMsg:'No tenemos vacantes en Coatzacoalcos...',
    messages:[
      {from:'lead',text:'Hola, quiero aplicar',time:'10:30 AM'},{from:'agent',text:GREETING('Eduardo'),time:'10:30 AM'},
      {from:'lead',text:'Si',time:'10:31 AM'},{from:'agent',text:Q_CITY,time:'10:31 AM'},
      {from:'lead',text:'Coatzacoalcos, Veracruz',time:'10:32 AM'},
      {from:'agent',text:'Nuestras sucursales estan en Guadalajara, Merida, CDMX, Ixtapaluca, Minatitlan y Tehuacan. Lamentablemente no tenemos vacante en Coatzacoalcos. Si se abre una posicion, te contactaremos. ¡Gracias!',time:'10:40 AM'},
    ]
  },
  {
    id:28, name:'Paola Andrea Moreno', phone:'+52 55 4321 8765', location:'CDMX',
    status:'rejected', avatar:'PM', time:'3:05 PM', unread:0,
    lastMsg:'La edad maxima para esta posicion es 45...',
    messages:[
      {from:'lead',text:'Me interesa la vacante',time:'2:50 PM'},{from:'agent',text:GREETING('Paola'),time:'2:50 PM'},
      {from:'lead',text:'Si',time:'2:51 PM'},{from:'agent',text:Q_CITY,time:'2:51 PM'},
      {from:'lead',text:'CDMX',time:'2:52 PM'},{from:'agent',text:Q_LICENSE,time:'2:52 PM'},
      {from:'lead',text:'Si',time:'2:53 PM'},{from:'agent',text:Q_MECHANIC,time:'2:53 PM'},
      {from:'lead',text:'Si, algo',time:'2:54 PM'},{from:'agent',text:Q_EDUCATION,time:'2:54 PM'},
      {from:'lead',text:'Prepa',time:'2:55 PM'},{from:'agent',text:Q_AGE,time:'2:55 PM'},
      {from:'lead',text:'52 anos',time:'2:56 PM'},
      {from:'agent',text:'La edad maxima para esta posicion es 45 anos. Lamentablemente no podemos continuar con el proceso. Agradecemos tu interes Paola.',time:'3:05 PM'},
    ]
  },
  ...[
    {id:29,name:'Antonio de Jesus Velazquez',av:'AV',ph:'+52 99 8765 4321',loc:'Merida, Yucatan',time:'4:20 PM',reason:'edu',ans:['Merida','Si','Algo','Solo termine la secundaria'],reject:'El requisito minimo de escolaridad es bachillerato. Te recomendamos completar tus estudios y volver a aplicar. ¡Gracias!'},
    {id:30,name:'Hector Manuel Nunez',av:'HN',ph:'+52 33 1234 0000',loc:'Guadalajara, Jalisco',time:'9:30 AM',reason:'sched',ans:['Guadalajara','Si','Si','Prepa','30','No, solo puedo medio tiempo'],reject:'El puesto requiere disponibilidad de horario completo de lunes a viernes 9:30-6:30 y sabados 9:30-3:00. Sin disponibilidad completa no podemos continuar. ¡Gracias Hector!'},
    {id:31,name:'Martha Elena Palacios',av:'MP',ph:'+52 55 0000 1111',loc:'Toluca, Estado de Mexico',time:'11:45 AM',reason:'city',ans:['Toluca'],reject:'Nuestras sucursales estan en Guadalajara, Merida, CDMX, Ixtapaluca, Minatitlan y Tehuacan. No tenemos vacante en Toluca. ¡Gracias Martha!'},
    {id:32,name:'Ernesto Rafael Monroy',av:'EM',ph:'+52 33 2222 3333',loc:'Guadalajara, Jalisco',time:'1:50 PM',reason:'lic',ans:['Guadalajara','No, me suspendieron la licencia'],reject:'La licencia de manejo vigente es un requisito indispensable. Una vez la recuperes, vuelve a aplicar. ¡Suerte Ernesto!'},
    {id:33,name:'Rosa Maria Cabrera',av:'RC',ph:'+52 99 4444 5555',loc:'Cancun, Quintana Roo',time:'10:20 AM',reason:'city',ans:['Cancun'],reject:'Nuestras sucursales estan en Guadalajara, Merida, CDMX, Ixtapaluca, Minatitlan y Tehuacan. No tenemos vacante en Cancun. ¡Gracias Rosa!'},
    {id:34,name:'Lorena Patricia Camacho',av:'LC',ph:'+52 22 6666 7777',loc:'Puebla, Puebla',time:'2:40 PM',reason:'city',ans:['Puebla capital'],reject:'Nuestra sucursal mas cercana esta en Tehuacan. No tenemos vacante en Puebla capital. ¡Gracias Lorena!'},
    {id:35,name:'David Emmanuel Juarez',av:'DJ',ph:'+52 55 8888 9999',loc:'CDMX',time:'5:15 PM',reason:'age',ans:['CDMX','Si','Si','Prepa','48'],reject:'La edad maxima para esta posicion es 45 anos. Agradecemos tu interes David.'},
  ].map(c => {
    const questions = [Q_CITY, Q_LICENSE, Q_MECHANIC, Q_EDUCATION, Q_AGE, Q_SCHEDULE]
    const msgs = [
      {from:'lead',text:'Hola, me interesa la vacante',time:c.time},
      {from:'agent',text:GREETING(c.name.split(' ')[0]),time:c.time},
      {from:'lead',text:'Si',time:c.time},
    ]
    for (let i = 0; i < c.ans.length; i++) {
      msgs.push({from:'agent',text:questions[i],time:c.time})
      msgs.push({from:'lead',text:c.ans[i],time:c.time})
    }
    msgs.push({from:'agent',text:c.reject,time:c.time})
    return {
      id:c.id, name:c.name, phone:c.ph, location:c.loc, status:'rejected', avatar:c.av, time:c.time, unread:0,
      lastMsg:c.reject.slice(0,45)+'...', messages:msgs
    }
  }),

  // ==================== NO RESPONSE (15) ====================
  ...['Gabriela Itzel Jimenez','Adriana Marcela Suarez','Alicia Fernanda Paredes','Teresa Jazmin Zarate',
      'Cristina Abigail Tellez','Carmen Denisse Salgado','Claudia Berenice Fuentes','Brenda Yolanda Rios',
      'Leslie Guadalupe Mejia','Monica Lizeth Acosta','Karla Vanessa Romero','Sofia Valentina Estrada',
      'Maria Guadalupe Gonzalez','Ana Lucia Hernandez','Itzel Alejandra Ortega'
  ].map((name, i) => {
    const cities = ['Guadalajara, Jalisco','Merida, Yucatan','CDMX','Ixtapaluca, Edo. Mex','Minatitlan, Veracruz','Tehuacan, Puebla']
    const initials = name.split(' ').map(n => n[0]).join('').slice(0,2)
    const hours = ['8:30 AM','9:15 AM','10:22 AM','11:05 AM','12:30 PM','1:45 PM','2:10 PM','3:00 PM','3:40 PM','4:15 PM','4:50 PM','5:20 PM','6:00 PM','7:15 PM','8:30 PM']
    const openers = ['Hola, me interesa la vacante','Info de la vacante porfavor','Hola, vi el anuncio','Me interesa el puesto de valuador','Hola quiero aplicar']
    return {
      id: 36+i, name, phone:`+52 ${30+i} ${1000+i*111} ${2000+i*222}`, location:cities[i%cities.length],
      status:'no_response', avatar:initials, time:hours[i], unread:0,
      lastMsg:'Hola! Gracias por tu interes...',
      messages:[
        {from:'lead',text:openers[i%openers.length],time:hours[i]},
        {from:'agent',text:GREETING(name.split(' ')[0]),time:hours[i]},
      ]
    }
  }),
]

export default conversations
