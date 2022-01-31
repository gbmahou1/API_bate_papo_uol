import express from 'express';
import cors from 'cors';
import Joi from 'joi';
import dayjs from 'dayjs';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';


dotenv.config();

console.log(process.env.MONGO_URI);
const mongoClient = new MongoClient(process.env.MONGO_URI);
dayjs().format()



const app = express();
app.use(express.json())
app.use(cors());

let db;

const participantSchema = Joi.object({
	
	name: Joi.string()
	.required()
	.alphanum()
	.min(1)

});

const messageSchema = Joi.object({
	    
	to: Joi.string()
        .alphanum()
        .min(1)
        .required(),

    	text: Joi.string()
        
		.alphanum()
        .min(1)
        .required(),
        

    	type: Joi.string()
		
		.valid('message', 'private_message')
        .required(),

});





setInterval(async () => {

	await mongoClient.connect()
	const dbApi = mongoClient.db("uolApi")

	try{

		const participantCollection = await dbApi.collection("participants").find({}).toArray(); //Recebe os participantes como uma array
        const currentStatus = Date.now(); //Adquire o "momento" atual

        for (const participant of participantCollection) {  //Percorre o array passando por cada participante

            if (participant.lastStatus < currentStatus - 10000) { //Checa se o participante atual está AFK


                await db.collection("participants").deleteOne({ lastStatus: participant.lastStatus });  //Expulsa o AFK


                await db.collection("messages").insertOne(  //Avisa na tela que o usuário saiu
                    {
                        from: participant.name, to: 'Todos', text: 'sai da sala...', type: 'status', time: dayjs().format('HH:mm:ss')
                    }
                )}}

        mongoClient.close();

	}
	catch (error) {

		console.log(error) //Avisa se tem algum erro
		mongoClient.close()

	}

}, 15000);  //Aguarda 15s e checa de novo




app.post('/participants', async (req, res) => {
    
	try {

		await mongoClient.connect() // Aguarda a conexão com o servidor

		const dbApi = mongoClient.db("uolApi"); // Recebe o banco de dados
		const participantsCollection = dbApi.collection("participants") // Recebe do banco de dados os participantes
		const messagesCollection = dbApi.collection("messages") // Recebe do banco de dados as mensagens

		const newParticipant = req.body //Recebe o novo nome a ser inserido
		const alreadyExists = await participantsCollection.findOne({newParticipant}) //Checa se o nome já existe no banco de dados

		const validateParticipant = participantSchema.validate(newParticipant, { abortEarly: false }) // Valida o novo participante
	

		if (validateParticipant.error) {

			if (alreadyExists == null) //Se o nome ainda não existe mas ainda é invalido se retorna erro 422
			{
				res.status(422).send("Usuário precisa ser preenchido!")
			}
			else //Se o nome já existe é retornado o erro 409
			{
				res.status(409).send("Usuario já existe...")
			}


			mongoClient.close()
			return
		}

		const sendParticipant = {  //Cria o objeto que sera enviao ao banco de dados
			name: newParticipant,
			lastStatus: Date.now(),
		}

		await participantsCollection.insertOne(sendParticipant) //Insere o novo participante no banco de dados

		let sendMessage = {  //Cria a mensagem de status que deve ser enviada
			from: sendParticipant.name,
			to: 'Todos',
			text: 'entra na sala...',
			type: 'status',
			time: dayjs(sendParticipant.lastStatus).format('HH:mm:ss')
		}

		await messagesCollection.insertOne(sendMessage)  //Insere a nova mensagem no servidor
	  
		res.sendStatus(201)  //Confirma que o envio foi bem sucedido
	
		mongoClient.close()

	 	} catch (error) {

		console.log(error)

	 	res.status(500).send("Deu ruim :/") //Avisa que ocorreu um erro

		mongoClient.close()
	 	}

});




app.get("/participants", async (req, res) => {

	try {
  
	  await mongoClient.connect() //Conecta ao servidor
	  const dbApi = mongoClient.db("uolApi"); //Recebe o banco de dados

  
	  const UsersCollection = dbApi.collection("participants") //Recebe a coleção de participantes
	  const UsersArray = await UsersCollection.find({}).toArray() //Cria um array de participantes
  
	  res.send(UsersArray) //Envia o array de participantes
	  mongoClient.close()

	} catch (error) {

		console.log(error)
		res.status(500).send("Deu ruim :/") //Avisa que ocorreu um erro
		mongoClient.close()

	}
  
});



app.get("/messages", async (req, res) => {

	try{
		
		await mongoClient.connect()  //Conecta ao servidor
		const dbApi = mongoClient.db("uolApi");  //Recebe o banco de dados

		const limit = parseInt(req.query.limit); //Recebe o limite de mensagens recebias a partir a query string
		const User = req.header("User")
		let messageCollection =  dbApi.collection("messages") //Recebe a coleção de mensagens
		const messageArray = await messageCollection.find({}).toArray() //Cria um array de mensagens a partir a coleção

		if (limit == null)
		{

			res.send(messageArray) //Envia o array de mensagens inteiro

		}
		else
		{

			const firstMessages = messageArray.splice(0,limit); //Pega o numero apropriado de mensagens a partir do limite
			res.send(firstMessages); //Envia o numero correto de mensagens

		}
		mongoClient.close()
	}
	catch (error) {

		console.log(error)
		res.status(500).send("Deu ruim :/")  //Avisa que ocorreu um erro
		mongoClient.close()

	}

	

});





app.post("/messages", async (req, res) => {
	
	try{


		await mongoClient.connect()  //Conecta ao servidor
		const dbApi = mongoClient.db("uolApi");  //Recebe o banco de dados

		const messagesCollection = dbApi.collection("messages")  //Recebe a coleção das mensagens

		let NewMessage = { from: req.header('User'), ...req.body } //Recebe o User a partir do header localizado no front e os dados do body

		const validateMessage = messageSchema.validate(NewMessage, { abortEarly: false }) //Valida os dados recebidos

		if (validateMessage.error) {
		  res.status(422).send("A mensagem não pode ser enviada :/") //Avisa caso ocorra algum erro
		  mongoClient.close()
		  return
		}

		await messagesCollection.insertOne(NewMessage)  //Insere a nova mensagem no servidor
	  
		res.sendStatus(201)  //Confirma que o envio foi bem sucedido
	    mongoClient.close()

	}
	catch (error) {

		console.log(error)
		res.status(500).send("Deu ruim :/") //Avisa que ocorreu um erro
		mongoClient.close()

	}
});




app.post("/status", async (req, res) => {

	try{

		await mongoClient.connect()  //Conecta ao servidor
		const dbApi = mongoClient.db("uolApi");  //Recebe o banco de dados
		const User = req.header("User")  //Recebe o usuário do header
		const participantsCollection = dbApi.collection("participants") // Recebe do banco de dados os participantes
		const user = await participantsCollection.findOne({ User }) //Busca o usuário na coleção

		if (user == null) //Se o usuário não está na coleção retornamos 404
		{
			res.sendStatus(404)
		}
		else //Se o usuário está na coleção atualizamos o lastStatus
		{
			await participantsCollection.updateOne({ 
				name: user.name  //Atualiza o status do usuário
			}, {$set :{ lastStatus: Date.now() }})  
		}

		mongoClient.close()

	}
	catch (error) {

		console.log(error)
		res.status(500).send("Deu ruim :/")  //Avisa que ocorreu um erro
		mongoClient.close()

	}
});



app.listen(5000);