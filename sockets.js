const QUESTION_TIME = 8000;

let currentQuestionIndex;

let candidatesData = [];
let Rooms = [];
let answerTime;

function generateRoomId() {
   return Math.floor(Math.random() * 899999 + 100000).toString();
}

function candidateExist(name) {
   for (let obj of candidatesData) {
      if (name.toLowerCase() === obj.candidateName.toLowerCase()) {
         return true;
      }
   }
   return false;
}

function getQuestions(room_id) {
   for (let obj of Rooms) {
      if (obj.room_id == room_id) {
         return obj.questions;
      }
   }
   return [];
}

function removeRoom(room_id) {
   Rooms = Rooms.filter((r) => r.room_id != room_id);
   removeCondidateByRoom(room_id);
}

function roomExist(room_id) {
   for (let obj of Rooms) {
      if (obj.room_id == room_id) {
         return true;
      }
   }
   return false;
}

function removeCondidateByRoom(room_id) {
   candidatesData = candidatesData.filter((c, i) => c.room_id != room_id);
}

function removeCondidateById(id) {
   candidatesData = candidatesData.filter((c, i) => c.id != id);
}

function getCandidateById(id) {
   return candidatesData.filter((c) => c.id === id);
}

function listen(io) {
   const quizNamespace = io.of("/quiz");

   quizNamespace.on("connection", (socket) => {
      console.log("a user connected", socket.id);

      socket.on("create-room", ({ questions }) => {
         const room_id = generateRoomId();
         Rooms.push({
            room_id: room_id,
            questions: questions,
         });

         console.log("room created");

         socket.join(room_id);
         socket.emit("room-status", {
            is_created: true,
            room_id: room_id,
         });
      });

      socket.on("joind-room", ({ room_id, candidate_name }) => {
         var error = "";

         console.log(room_id + " " + candidate_name);
         console.log(Rooms);
         if (roomExist(room_id)) {
            if (!candidateExist(candidate_name)) {
               console.log(778);
               socket.join(room_id);
               candidatesData.push({
                  id: socket.id,
                  candidateName: candidate_name,
                  score: 0,
                  room_id: room_id,
               });
               quizNamespace.in(room_id).emit("candidate-joind", {
                  candidatesData,
                  error,
               });
            } else {
               error = "this name is already taken !";
               socket.emit("candidate-joind", {
                  candidatesData,
                  error,
               });
            }
         } else {
            error = "room not exist!";
            socket.emit("candidate-joind", {
               candidatesData,
               error,
            });
         }
      });

      socket.on("start-quiz", ({ room_id }) => {
         const Questions = getQuestions(room_id);

         if (roomExist(room_id) && Questions.length > 0) {
            currentQuestionIndex = 0;

            // send the first question
            quizNamespace.in(room_id).emit("update-question", {
               question: Questions[currentQuestionIndex].question,
               choices: Questions[currentQuestionIndex].choices,
            });
            answerTime = Date.now();

            // send the others question
            var timeout = setInterval(function () {
               if (currentQuestionIndex >= Questions.length - 1) {
                  quizNamespace.in(room_id).emit("quiz-over");
                  removeRoom(room_id);
                  clearInterval(timeout);
               } else {
                  currentQuestionIndex++;
                  quizNamespace.in(room_id).emit("update-question", {
                     question: Questions[currentQuestionIndex].question,
                     choices: Questions[currentQuestionIndex].choices,
                  });
                  answerTime = Date.now();
               }
            }, QUESTION_TIME);
         }
      });

      socket.on("send-answer", ({ room_id, answer }) => {
         if (currentQuestionIndex < getQuestions(room_id).length) {
            if (getQuestions(room_id)[currentQuestionIndex].answer == answer) {
               for (const obj of candidatesData) {
                  if (obj.id == socket.id) {
                     score = Math.floor(
                        (QUESTION_TIME - (Date.now() - answerTime)) * 0.01
                     );
                     obj.score += score;
                  }
               }
            }
         }

         quizNamespace.in(room_id).emit("update-score", {
            candidatesData,
         });
      });

      socket.on("disconnect", (reason) => {
         console.log(`Client ${socket.id} disconnected: ${reason}`);

         if (getCandidateById(socket.id).length > 0) {
            let room = getCandidateById(socket.id)[0].room;

            removeCondidateById(socket.id);
            socket.leave(room);
            quizNamespace.in(room).emit("candidate-joind", {
               candidatesData,
            });
         }
      });
   });
}

module.exports = {
   listen,
};
