import { Box, Dialog, DialogContent, DialogTitle, Toolbar, CircularProgress, Typography, Paper, Container, Button, Grid, TextField, Backdrop, Stack } from '@mui/material'
import { DashboardAppBar } from './components/DashboardAppBar'

import PropTypes from 'prop-types'

import { useFormik } from 'formik'
import React, { useEffect, useState } from 'react'

import { sum } from 'lodash'

import { DQNSolver, DQNOpt, DQNEnv } from 'reinforce-js'

const CircularProgressWithLabel = (props: {value: number}) => {
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex', marginRight: '30px' }}>
      <CircularProgress variant="determinate" {...props} size={60} color="success" />
      <Box
        sx={{
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Typography variant="subtitle1" component="div" color="text.secondary">
          {`${Math.round(props.value)}%`}
        </Typography>
      </Box>
    </Box>
  )
}

CircularProgressWithLabel.propTypes = {
  /**
   * The value of the progress indicator for the determinate variant.
   * Value between 0 and 100.
   * @default 0
   */
  value: PropTypes.number.isRequired
}

const nextValue = ({ outcome, highGivenLow, highGivenHigh } : {outcome: number, highGivenLow: number, highGivenHigh: number}) => {
  const randomNumber = Math.random()

  return (outcome === 0 && randomNumber <= highGivenLow) || (outcome === 1 && randomNumber <= highGivenHigh)
    ? 1
    : 0
}

type Outcomes = {
  startHigh: number,
  startLow: number,
  highGivenHigh: number,
  lowGivenHigh: number,
  highGivenLow: number,
  lowGivenLow: number,
  numPeriods: number,
}

const generateOutcomesSingle = ({ startHigh, startLow, highGivenHigh, lowGivenHigh, highGivenLow, lowGivenLow, numPeriods }: Outcomes) => {
  const startRandomNumber = Math.random()

  const firstValue = startRandomNumber < startHigh ? 1 : 0

  const result: number[] = Array(numPeriods).fill(-1)
  result[0] = firstValue

  for (let i = 0; i < numPeriods - 1; i++) { // numPeriods - 1 because first state already initialised
    const nextValueResult = nextValue({ outcome: result[i], highGivenLow, highGivenHigh })
    result[i + 1] = nextValueResult
  }

  return result
}

export const App = () => {
  const initialSimValues = {
    highPayoff: 10,
    lowPayoff: 5,
    startHigh: 0.2,
    startLow: 0.8,
    highGivenHigh: 0.2,
    lowGivenHigh: 0.8,
    highGivenLow: 0.2,
    lowGivenLow: 0.8,
    discountFactor: 0.99,
    learningRate: 0.10,
    numPeriods: 50,
    numLearnIterations: 100,
    numTestIterations: 100
  }

  const [open, setOpen] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [dialogueOpen, setDialogueOpen] = useState(false)
  const [avScore, setAvScore] = useState(0)
  const [maxScore, setMaxScore] = useState(0)

  const handleClose = () => {
    setOpen(false)
  }
  const handleOpen = () => {
    setOpen(true)
  }

  const formik = useFormik({
    initialValues: initialSimValues,
    onSubmit: (values) => {
      handleOpen()

      setStatusText('Training Model...')

      setTimeout(() => {
        // eslint-disable-next-line prefer-const
        let { startHigh, startLow, highGivenHigh, lowGivenHigh, highGivenLow, lowGivenLow, numPeriods, numLearnIterations, numTestIterations, discountFactor, learningRate, highPayoff, lowPayoff } = values;

        [startHigh, startLow, highGivenHigh, lowGivenHigh, highGivenLow, lowGivenLow, numPeriods, numLearnIterations, numTestIterations, discountFactor, learningRate, highPayoff, lowPayoff] = [startHigh, startLow, highGivenHigh, lowGivenHigh, highGivenLow, lowGivenLow, numPeriods, numLearnIterations, numTestIterations, discountFactor, learningRate, highPayoff, lowPayoff].map(Number)

        // ReinforceJS Config Here. See https://github.com/mvrahden/reinforce-js/blob/master/examples/dqn-solver-src.md

        const width = 400
        const height = 400
        const numberOfStates = 50
        const numberOfActions = 2
        const env = new DQNEnv(width, height, numberOfStates, numberOfActions)

        const opt = new DQNOpt()
        opt.setTrainingMode(true)
        opt.setNumberOfHiddenUnits([100]) // mind the array here, currently only one layer supported! Preparation for DNN in progress...
        opt.setEpsilonDecay(1.0, 0.1, 1e6)
        opt.setEpsilon(learningRate)
        opt.setGamma(discountFactor)
        opt.setAlpha(0.005)
        opt.setLossClipping(true)
        opt.setLossClamp(1.0)
        opt.setRewardClipping(true)
        opt.setRewardClamp(1.0)
        opt.setExperienceSize(1e6)
        opt.setReplayInterval(5)
        opt.setReplaySteps(5)

        const dqnSolver = new DQNSolver(env, opt)

        // Training Now
        const singleLearnIteration = (state: number[]) => { // one iteration of learning
          const revealedState = Array(numPeriods).fill(-1)
          const rewards = Array(numPeriods).fill(0)

          for (let i = 0; i < numPeriods; i++) {
            const action = dqnSolver.decide(revealedState) // 0 means low, 1 means high
            revealedState[i] = state[i]
            if (action === 0) {
              dqnSolver.learn(lowPayoff)
              rewards[i] = lowPayoff
            } else if (state[i] === 1) {
              dqnSolver.learn(highPayoff)
              rewards[i] = highPayoff
            } else {
              // NO reward if action === 1 and state === 0
              dqnSolver.learn(0)
            }
          }
          return rewards
        }

        const runAllLearnIterations = (nIterations: number) => {
          let solution
          for (let i = 0; i < nIterations; i++) {
            const outcomes = generateOutcomesSingle({ startHigh, startLow, highGivenHigh, lowGivenHigh, highGivenLow, lowGivenLow, numPeriods })
            solution = singleLearnIteration(outcomes)
          }
          return solution
        }

        runAllLearnIterations(numLearnIterations)

        // Now test mode

        setStatusText('Testing Results...')
        setTimeout(() => {
          opt.setTrainingMode(false)

          const singleTestIteration = (state: number[]) => { // one iteration of test
            const revealedState = Array(numPeriods).fill(-1)
            const rewards = Array(numPeriods).fill(0)

            for (let i = 0; i < numPeriods; i++) {
              const action = dqnSolver.decide(revealedState) // 0 means low, 1 means high
              revealedState[i] = state[i]

              if (action === 0) {
                rewards[i] = lowPayoff
              } else if (state[i] === 1) {
                rewards[i] = highPayoff
              } // NO reward if action === 1 and state === 0
            }

            const bestCase = revealedState.map((state) => state === 1 ? highPayoff : lowPayoff)

            return {
              achieved: sum(rewards),
              maximum: sum(bestCase)
            }
          }

          const runAllTestIterations = (nIterations: number) => {
            const solution = {
              achieved: 0,
              maximum: 0
            }

            for (let i = 0; i < nIterations; i++) {
              const outcomes = generateOutcomesSingle({ startHigh, startLow, highGivenHigh, lowGivenHigh, highGivenLow, lowGivenLow, numPeriods })

              const { achieved, maximum } = singleTestIteration(outcomes)
              solution.achieved += achieved
              solution.maximum += maximum
            }

            solution.achieved /= nIterations
            solution.maximum /= nIterations

            setAvScore(solution.achieved)
            setMaxScore(solution.maximum)

            return solution
          }
          const finalResult = runAllTestIterations(numTestIterations)
          handleClose()
          setDialogueOpen(true)
          return finalResult
        }, 10)
      }, 10)
    }
  })

  return (
    <Box>
      {/* Backdrop for loading */}
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={open}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }} >
          <CircularProgress color="inherit" />
          <Typography sx={{ marginLeft: '20px' }}>{statusText}</Typography>
        </Box>
      </Backdrop>

      {/* Dialogue with results */}
      <Dialog onClose={() => setDialogueOpen(false)} open={dialogueOpen}>
        <DialogTitle>Simulation Results</DialogTitle>
        <DialogContent>
          <Box sx={{ minWidth: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'row' }} >
            <CircularProgressWithLabel value={avScore / maxScore * 100} />
            <Stack>
              <Typography>Total Score: {Math.round(avScore)}</Typography>
              <Typography>Max Score: {Math.round(maxScore)}</Typography>
            </Stack>
          </Box>
        </DialogContent>
      </Dialog>
      <DashboardAppBar />
      <Toolbar />

      <Container component="main" maxWidth="sm" sx={{ mb: 4 }}>
        <Paper variant="outlined" sx={{ my: { xs: 3, md: 6 }, p: { xs: 2, md: 3 } }}>
          <Typography component="h1" variant="h4" align="center" marginBottom="4px">
            Configuration
          </Typography>

          <form onSubmit={formik.handleSubmit}>

            <Typography variant="h6" gutterBottom marginTop="2px">
            Payoffs
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  id="highPayoff"
                  name="highPayoff"
                  label="High Payoff e.g. 10"
                  fullWidth
                  variant="standard"
                  value={formik.values.highPayoff}
                  onChange={formik.handleChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  id="lowPayoff"
                  name="lowPayoff"
                  label="Low Payoff e.g. 5"
                  fullWidth
                  variant="standard"
                  value={formik.values.lowPayoff}
                  onChange={formik.handleChange}
                />
              </Grid>
            </Grid>
            <Typography variant="h6" gutterBottom marginTop="40px">
            Initial Probabilities
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  id="startHigh"
                  name="startHigh"
                  label="Initial Probability (High) e.g. 0.2"
                  fullWidth
                  variant="standard"
                  value={formik.values.startHigh}
                  onChange={formik.handleChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  id="startLow"
                  name="startLow"
                  label="Initial Probability (Low) e.g. 0.8"
                  fullWidth
                  variant="standard"
                  value={formik.values.startLow}
                  onChange={formik.handleChange}
                />
              </Grid>
            </Grid>
            <Typography variant="h6" gutterBottom marginTop="40px">
            Transition Matrix
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  id="highGivenHigh"
                  name="highGivenHigh"
                  label="Pr(High | High) e.g. 0.2"
                  fullWidth
                  variant="standard"
                  value={formik.values.highGivenHigh}
                  onChange={formik.handleChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  id="lowGivenHigh"
                  name="lowGivenHigh"
                  label="Pr(Low | High) e.g. 0.8"
                  fullWidth
                  variant="standard"
                  value={formik.values.lowGivenHigh}
                  onChange={formik.handleChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  id="highGivenLow"
                  name="highGivenLow"
                  label="Pr(High | Low) e.g. 0.2"
                  fullWidth
                  variant="standard"

                  value={formik.values.highGivenLow}
                  onChange={formik.handleChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  id="lowGivenLow"
                  name="lowGivenLow"
                  label="Pr(Low | Low) e.g. 0.8"
                  fullWidth
                  variant="standard"
                  value={formik.values.lowGivenLow}
                  onChange={formik.handleChange}
                />
              </Grid>
            </Grid>
            <Typography variant="h6" gutterBottom marginTop="40px">
            Discount Factor and Learning Rate
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  id="discountFactor"
                  name="discountFactor"
                  label="Discount Factor e.g. 0.99"
                  fullWidth
                  variant="standard"
                  value={formik.values.discountFactor}
                  onChange={formik.handleChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  id="learningRate"
                  name="learningRate"
                  label="Learning Rate e.g. 0.10"
                  fullWidth
                  variant="standard"
                  value={formik.values.learningRate}
                  onChange={formik.handleChange}
                />
              </Grid>
            </Grid>
            <Typography variant="h6" gutterBottom marginTop="40px">
            Number of time periods and iterations
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  id="numPeriods"
                  name="numPeriods"
                  label="Number of time periods e.g. 50"
                  fullWidth
                  variant="standard"
                  value={formik.values.numPeriods}
                  onChange={formik.handleChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  id="numLearnIterations"
                  name="numLearnIterations"
                  label="Number of learning iterations e.g. 100"
                  fullWidth
                  variant="standard"
                  value={formik.values.numLearnIterations}
                  onChange={formik.handleChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  id="numTestIterations"
                  name="numTestIterations"
                  label="Number of test iterations e.g. 100"
                  fullWidth
                  variant="standard"
                  value={formik.values.numTestIterations}
                  onChange={formik.handleChange}
                />
              </Grid>
            </Grid>
            <Box marginTop="40px" sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button variant="contained" type="submit">Run!</Button>
            </Box>
          </form>
        </Paper>
      </Container>
    </Box>)
}
