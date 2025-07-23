document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const humanHandElement = document.getElementById('human-hand');
    const opponentHandElements = {
        'CPU 1': document.querySelector('#player-area-opponent-1 .hand'),
        'CPU 2': document.querySelector('#player-area-opponent-2 .hand'),
        'CPU 3': document.querySelector('#player-area-opponent-3 .hand'),
    };
    const tableCardsElement = document.getElementById('table-cards');
    const statusMessageElement = document.getElementById('status-message');
    const playButton = document.getElementById('play-button');
    const passButton = document.getElementById('pass-button');

    // --- Game State ---
    const players = ['CPU 1', 'CPU 2', 'Human', 'CPU 3'];
    let hands = {};
    let currentPlayerIndex = 0;
    let tableCards = [];
    let passCount = 0;
    let gameActive = true;
    let rankings = []; // 順位を記録
    let activePlayers = []; // 現在プレイ中のプレイヤー
    let isRevolution = false; // 革命状態かどうかのフラグ

    // --- Game Logic ---

    /**
     * Initializes the game.
     */
    function initializeGame() {
        const deck = createDeck();
        shuffleDeck(deck);
        dealCards(deck);
        renderHands();
        activePlayers = [...players]; // 全員をアクティブプレイヤーに設定
        currentPlayerIndex = players.indexOf('Human'); // Human starts
        updateStatus();
        addEventListeners();
    }

    /**
     * Creates a standard 52-card deck + 2 Jokers.
     * @returns {Array<object>} The deck of cards.
     */
    function createDeck() {
        const suits = ['♥', '♦', '♣', '♠'];
        const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
        const deck = [];
        for (const suit of suits) {
            for (const rank of ranks) {
                deck.push({ suit, rank, id: `${suit}${rank}` });
            }
        }
        deck.push({ suit: 'Joker', rank: 'Joker', id: 'Joker1' });
        deck.push({ suit: 'Joker', rank: 'Joker', id: 'Joker2' });
        return deck;
    }

    /**
     * Gets the numerical value of a card for sorting.
     * @param {string} rank - The rank of the card.
     * @returns {number} The numerical value.
     */
    function getCardValue(rank) {
        const rankValues = { '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, '2': 15 };
        if (rank === 'Joker') return 99; // Joker is always strongest
        if (rank === '8') return 98; // 8 has a special high value for "8-slice" logic, but isn't the strongest card

        if (isRevolution) {
            const value = rankValues[rank];
            // In revolution, strength is inverted, but 8 and Joker are exceptions
            if (value >= 3 && value <= 15) {
                return 18 - value; // (3->15, 4->14, ..., A->4, 2->3)
            }
            return value; // Should not be reached for standard cards
        } else {
            return rankValues[rank];
        }
    }

    /**
     * Shuffles the deck randomly.
     * @param {Array<object>} deck - The deck to shuffle.
     */
    function shuffleDeck(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }

    /**
     * Deals the cards to the players.
     * @param {Array<object>} deck - The shuffled deck.
     */
    function dealCards(deck) {
        players.forEach(player => hands[player] = []);
        let playerIndex = 0;
        deck.forEach(card => {
            hands[players[playerIndex]].push(card);
            playerIndex = (playerIndex + 1) % players.length;
        });

        for (const player in hands) {
            hands[player].sort((a, b) => getCardValue(a.rank) - getCardValue(b.rank));
        }
    }

    /**
     * Renders the cards in each player's hand.
     */
    function renderHands() {
        humanHandElement.innerHTML = '';
        hands['Human'].sort((a, b) => getCardValue(a.rank) - getCardValue(b.rank)).forEach(card => {
            const cardElement = createCardElement(card);
            cardElement.addEventListener('click', () => toggleCardSelection(cardElement));
            humanHandElement.appendChild(cardElement);
        });

        for (const opponent of ['CPU 1', 'CPU 2', 'CPU 3']) {
            if (rankings.includes(opponent)) continue;

            const handElement = opponentHandElements[opponent];
            handElement.innerHTML = ''; // Clear previous content
            const cardCount = hands[opponent].length;

            if (cardCount > 0) {
                const container = document.createElement('div');
                container.className = 'card-back-container';

                const cardBack = document.createElement('div');
                cardBack.className = 'card-back';
                container.appendChild(cardBack);

                const countElement = document.createElement('span');
                countElement.className = 'card-count';
                countElement.textContent = cardCount;
                container.appendChild(countElement);

                handElement.appendChild(container);
            }
        }
    }

    /**
     * Creates a DOM element for a card.
     * @param {object} card - The card object.
     * @returns {HTMLElement} The card element.
     */
    function createCardElement(card) {
        const element = document.createElement('div');
        element.className = 'card';
        element.dataset.cardId = card.id;

        const suit = card.suit;
        const rank = card.rank;

        if (suit === 'Joker') {
            element.classList.add('joker');
            element.innerHTML = `<span class="rank">Joker</span>`;
        } else {
            element.classList.add((suit === '♥' || suit === '♦') ? 'red' : 'black');
            element.innerHTML = `<span class="suit">${suit}</span><span class="rank">${rank}</span>`;
        }
        return element;
    }

    function toggleCardSelection(cardElement) {
        if (players[currentPlayerIndex] === 'Human') {
            cardElement.classList.toggle('selected');
        }
    }

    function addEventListeners() {
        playButton.addEventListener('click', handlePlayAction);
        passButton.addEventListener('click', handlePassAction);
    }

    function updateStatus() {
        const currentPlayer = players[currentPlayerIndex];
        statusMessageElement.textContent = `${currentPlayer}'s turn`;

        const isHumanTurn = currentPlayer === 'Human';
        playButton.disabled = !isHumanTurn;
        passButton.disabled = !isHumanTurn;

        if (!isHumanTurn && gameActive) {
            setTimeout(playCpuTurn, 1500);
        }
    }

    /**
     * Checks if a play consists of only 8s (and/or Jokers).
     * @param {Array<object>} cards - The cards to check.
     * @returns {boolean}
     */
    function isEightSlicePlay(cards) {
        if (cards.length === 0) return false;
        // An 8-slice play consists only of 8s and Jokers.
        return cards.every(c => c.rank === '8' || c.rank === 'Joker');
    }

    function handlePlayAction() {
        if (players[currentPlayerIndex] !== 'Human' || !gameActive) return;

        const selectedElements = humanHandElement.querySelectorAll('.selected');
        if (selectedElements.length === 0) {
            alert('カードを選択してください。');
            return;
        }

        const selectedCards = Array.from(selectedElements).map(el => {
            const cardId = el.dataset.cardId;
            return hands['Human'].find(c => c.id === cardId);
        });

        if (isValidPlay(selectedCards)) {
            const currentPlayer = players[currentPlayerIndex];
            const oldTableCards = [...tableCards];

            const playType = getPlayType(selectedCards);
            const isEightSlice = isEightSlicePlay(selectedCards);
            const isSpade3Reversal = oldTableCards.length === 1 && oldTableCards[0].rank === 'Joker' &&
                                     selectedCards.length === 1 && selectedCards[0].id === '♠3';

            hands[currentPlayer] = hands[currentPlayer].filter(card => !selectedCards.some(sc => sc.id === card.id));
            tableCards = selectedCards;
            renderTable();
            renderHands();

            if (hands[currentPlayer].length === 0) {
                playerWins(currentPlayer);
                if (isSpade3Reversal || isEightSlice) {
                    tableCards = [];
                    renderTable();
                    passCount = 0;
                }
                nextTurn();
                return;
            }

            if ((playType === 'quad' || playType === 'sequence') && selectedCards.length >= 4) {
                isRevolution = !isRevolution;
                statusMessageElement.textContent = "革命発生！カードの強さが逆転しました！";
                for (const player in hands) {
                    hands[player].sort((a, b) => getCardValue(a.rank) - getCardValue(b.rank));
                }
                renderHands();
                setTimeout(() => {
                    tableCards = [];
                    renderTable();
                    passCount = 0;
                    updateStatus();
                }, 1500);
                return;
            }

            if (isSpade3Reversal || isEightSlice) {
                const message = isSpade3Reversal ? "スペ3返し！" : "8切り！";
                statusMessageElement.textContent = `${currentPlayer}が${message}`;
                // 8-slice clears the table and the current player gets to play again.
                setTimeout(() => {
                    tableCards = [];
                    renderTable();
                    passCount = 0;
                    // Do NOT call nextTurn(), the same player continues.
                    updateStatus(); 
                }, 1000);
            } else {
                passCount = 0;
                nextTurn();
            }

        } else {
            alert('そのカードは出せません。ルールを確認してください。');
        }
    }

    function handlePassAction() {
        if (!gameActive) return;
        
        passCount++;
        if (passCount >= activePlayers.length - 1) {
            tableCards = [];
            renderTable();
            passCount = 0;
            statusMessageElement.textContent = "場が流れました。";
        }
        
        nextTurn();
    }

    function playCpuTurn() {
        if (!gameActive) return;
        const currentPlayer = players[currentPlayerIndex];
        const hand = hands[currentPlayer];

        let play = findBestPlay(hand);

        if (play.length > 0) {
            const oldTableCards = [...tableCards];
            const playType = getPlayType(play);
            const isEightSlice = isEightSlicePlay(play);
            const isSpade3Reversal = oldTableCards.length === 1 && oldTableCards[0].rank === 'Joker' &&
                                     play.length === 1 && play[0].id === '♠3';

            hands[currentPlayer] = hand.filter(card => !play.some(pc => pc.id === card.id));
            tableCards = play;
            renderTable();
            renderHands();
            
            console.log(`${currentPlayer} plays:`, play.map(c => c.rank).join(' '));

            if (hands[currentPlayer].length === 0) {
                playerWins(currentPlayer);
                if (isSpade3Reversal || isEightSlice) {
                    tableCards = [];
                    renderTable();
                    passCount = 0;
                }
                nextTurn();
                return;
            }

            if ((playType === 'quad' || playType === 'sequence') && play.length >= 4) {
                isRevolution = !isRevolution;
                statusMessageElement.textContent = "革命発生！カードの強さが逆転しました！";
                for (const player in hands) {
                    hands[player].sort((a, b) => getCardValue(a.rank) - getCardValue(b.rank));
                }
                renderHands();
                setTimeout(() => {
                    tableCards = [];
                    renderTable();
                    passCount = 0;
                    updateStatus();
                }, 1500);
                return;
            }
            
            if (isSpade3Reversal || isEightSlice) {
                const message = isSpade3Reversal ? "スペ3返し！" : "8切り！";
                statusMessageElement.textContent = `${currentPlayer}が${message}`;
                // 8-slice clears the table and the current player gets to play again.
                setTimeout(() => {
                    tableCards = [];
                    renderTable();
                    passCount = 0;
                    // Do NOT call nextTurn(), the same player continues.
                    updateStatus(); 
                }, 1000);
            } else {
                passCount = 0;
                nextTurn();
            }

        } else {
            console.log(`${currentPlayer} passes.`);
            passCount++;
            if (passCount >= activePlayers.length - 1) {
                tableCards = [];
                renderTable();
                passCount = 0;
            }
            nextTurn();
        }
    }

    function groupBy(objectArray, property) {
        return objectArray.reduce((acc, obj) => {
            const key = obj[property];
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(obj);
            return acc;
        }, {});
    }

    function findBestPlay(hand) {
        const sortedHand = [...hand].sort((a, b) => getCardValue(a.rank) - getCardValue(b.rank));

        if (tableCards.length === 1 && tableCards[0].rank === 'Joker') {
            const spade3 = sortedHand.find(c => c.id === '♠3');
            if (spade3) return [spade3];
        }

        let possiblePlays = [];

        if (tableCards.length > 0) {
            const tableType = getPlayType(tableCards);
            const numCards = tableCards.length;

            if (tableType === 'invalid') return [];

            const groups = groupBy(sortedHand.filter(c => c.rank !== 'Joker'), 'rank');
            const jokers = sortedHand.filter(c => c.rank === 'Joker');

            if (tableType === 'sequence') {
                // AI for sequences is complex, for now, we pass on sequences
                return [];
            } else {
                for (const rank in groups) {
                    const group = groups[rank];
                    if (group.length <= numCards && group.length + jokers.length >= numCards) {
                        const neededJokers = numCards - group.length;
                        const play = [...group, ...jokers.slice(0, neededJokers)];
                        if (isValidPlay(play)) {
                            possiblePlays.push(play);
                        }
                    }
                }
                if (jokers.length >= numCards) {
                    const play = jokers.slice(0, numCards);
                    if (isValidPlay(play)) {
                        possiblePlays.push(play);
                    }
                }
            }
        } else {
            const groups = groupBy(sortedHand.filter(c => c.rank !== 'Joker'), 'rank');
            if (sortedHand.length > 0) {
                possiblePlays.push([sortedHand[0]]);
            }
            for (const rank in groups) {
                if (groups[rank].length > 1) {
                    if(isValidPlay(groups[rank])) possiblePlays.push(groups[rank]);
                }
            }
        }

        if (possiblePlays.length === 0) return [];

        possiblePlays.sort((a, b) => getHandValue(a) - getHandValue(b));

        return possiblePlays[0];
    }

    function isValidPlay(playedCards) {
        if (playedCards.length === 0) return false;

        const playType = getPlayType(playedCards);
        if (playType === 'invalid') return false;

        // Special rule: Spade 3 reversal
        if (tableCards.length === 1 && tableCards[0].rank === 'Joker' &&
            playedCards.length === 1 && playedCards[0].id === '♠3') {
            return true;
        }

        if (tableCards.length === 0) {
            return true;
        }

        // Special rule: 8-slice
        if (isEightSlicePlay(playedCards)) {
            // 8-slice is only valid if there are cards on the table
            if (tableCards.length === 0) {
                return false;
            }
            // An 8-slice cannot be played on a Joker.
            if (tableCards.some(c => c.rank === 'Joker')) {
                return false;
            }
            // The number of cards must match the table
            if (playedCards.length !== tableCards.length) {
                return false;
            }
            // 8-slice is a valid play if conditions are met.
            return true;
        }

        // Standard play validation
        const tableType = getPlayType(tableCards);
        if (playedCards.length !== tableCards.length || playType !== tableType) {
            return false;
        }

        const playedValue = getHandValue(playedCards);
        const tableValue = getHandValue(tableCards);

        return playedValue > tableValue;
    }

    function getPlayType(cards) {
        if (cards.length === 0) return 'invalid';
        if (cards.some(c => !c || !c.rank)) return 'invalid';

        if (isSequence(cards)) {
            return 'sequence';
        }

        const nonJokers = cards.filter(c => c.rank !== 'Joker');
        const firstRank = nonJokers.length > 0 ? nonJokers[0].rank : 'Joker';

        if (!nonJokers.every(c => c.rank === firstRank)) {
            return 'invalid';
        }

        if (firstRank === 'Joker' || nonJokers.every(c => c.rank === firstRank)) {
            switch (cards.length) {
                case 1: return 'single';
                case 2: return 'pair';
                case 3: return 'triple';
                default: return 'quad';
            }
        }

        return 'invalid';
    }

    function isSequence(cards) {
        if (cards.length < 3) return false;
        
        const nonJokers = cards.filter(c => c.rank !== 'Joker').sort((a,b) => getCardValue(a.rank) - getCardValue(b.rank));
        if (nonJokers.length === 0) return false;

        const firstSuit = nonJokers[0].suit;
        if (!nonJokers.every(c => c.suit === firstSuit)) return false;

        // Check for duplicate ranks
        const ranks = nonJokers.map(c => c.rank);
        if (new Set(ranks).size !== ranks.length) {
            return false;
        }

        const values = nonJokers.map(c => getCardValue(c.rank));
        let jokersToUse = cards.length - nonJokers.length;

        for (let i = 0; i < values.length - 1; i++) {
            const diff = values[i+1] - values[i];
            if (diff > 1) {
                jokersToUse -= (diff - 1);
            } else if (diff !== 1) {
                return false;
            }
        }

        return jokersToUse >= 0;
    }

    function getHandValue(cards) {
        if (cards.length === 0) return 0;
        
        const nonJokers = cards.filter(c => c.rank !== 'Joker');
        if (nonJokers.length === 0) return 99; // Joker only hand

        if (isSequence(cards)) {
            // For sequences, the value is the highest card.
            // This needs to account for jokers filling in gaps.
            const values = nonJokers.map(c => getCardValue(c.rank));
            let highestValue = Math.max(...values);
            let jokersAvailable = cards.length - nonJokers.length;
            
            // Check if jokers can extend the sequence upwards
            let tempHighest = highestValue;
            while (jokersAvailable > 0) {
                // This logic is tricky. For now, just use the highest real card.
                // A more advanced version would calculate the highest possible card.
                jokersAvailable--;
            }
            return highestValue;
        }
        
        return getCardValue(nonJokers[0].rank);
    }

    function renderTable() {
        tableCardsElement.innerHTML = '';
        tableCards.forEach(card => {
            tableCardsElement.appendChild(createCardElement(card));
        });
    }

    function nextTurn() {
        if (!gameActive) return;

        do {
            currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
        } while (!activePlayers.includes(players[currentPlayerIndex]));

        updateStatus();
    }

    function playerWins(winner) {
        console.log(`${winner} has finished!`);
        rankings.push(winner);
        activePlayers = activePlayers.filter(p => p !== winner);

        let winnerHandElement;
        if (winner === 'Human') {
            winnerHandElement = humanHandElement;
        } else {
            winnerHandElement = opponentHandElements[winner];
        }

        if (winnerHandElement) {
            winnerHandElement.innerHTML = `<p class="rank-display">${rankings.length}位</p>`;
        }

        if (activePlayers.length <= 1) {
            endGame();
        }
    }

    function endGame() {
        gameActive = false;
        if (activePlayers.length === 1) {
            rankings.push(activePlayers[0]);
            playerWins(activePlayers[0]);
        }

        let rankingStr = '最終順位:\n';
        rankings.forEach((player, index) => {
            rankingStr += `${index + 1}位: ${player}\n`;
        });

        statusMessageElement.textContent = 'ゲーム終了！';
        setTimeout(() => alert(rankingStr), 500);

        playButton.disabled = true;
        passButton.disabled = true;
    }

    // --- Game Start ---
    initializeGame();
});